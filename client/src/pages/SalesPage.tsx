import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { 
  ShoppingCart, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  Calculator,
  Gift,
  Percent,
  CreditCard,
  Smartphone,
  Banknote,
  Building2
} from 'lucide-react';

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
  serialNumber?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  customPricing?: any;
}

export default function SalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  // Search products
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['product-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=10`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Barcode search
  const { data: barcodeResults } = useQuery({
    queryKey: ['barcode-search', searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/products/search/barcode/${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Barcode search failed');
      return response.json();
    },
    enabled: searchQuery.length > 5 && /^[0-9A-Za-z-]+$/.test(searchQuery),
  });

  // Get offers
  const { data: offers } = useQuery({
    queryKey: ['active-offers'],
    queryFn: async () => {
      const response = await fetch('/api/offers/active');
      if (!response.ok) throw new Error('Failed to fetch offers');
      return response.json();
    },
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (!response.ok) throw new Error('Failed to create sale');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Sale completed successfully!' });
      setCart([]);
      setCustomer(null);
      setDiscount(0);
      setTax(0);
      setPayments([]);
      setNotes('');
      setShowPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Add product to cart
  const addToCart = (product: any, variant?: any) => {
    const existingItem = cart.find(item => 
      item.productId === product.id && item.variantId === variant?.id
    );

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      const price = variant?.sellingPrice || product.sellingPrice;
      const cost = variant?.costPrice || product.costPrice;
      const newItem: CartItem = {
        id: `${product.id}-${variant?.id || 'main'}-${Date.now()}`,
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        image: product.image,
        sku: variant?.sku || product.sku,
        quantity: 1,
        unitPrice: Number(price),
        costPrice: Number(cost),
        total: Number(price),
      };
      setCart([...cart, newItem]);
    }
    setSearchQuery('');
  };

  // Update cart item quantity
  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== itemId));
    } else {
      setCart(cart.map(item =>
        item.id === itemId
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item
      ));
    }
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxAmount = ((subtotal - discountAmount) * tax) / 100;
  const total = subtotal - discountAmount + taxAmount;
  const totalProfit = cart.reduce((sum, item) => sum + ((item.unitPrice - item.costPrice) * item.quantity), 0);

  // Handle payment
  const handlePayment = () => {
    if (cart.length === 0) {
      toast({ title: 'Error', description: 'Cart is empty', variant: 'destructive' });
      return;
    }

    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (totalPaid < total) {
      toast({ title: 'Error', description: 'Payment amount is insufficient', variant: 'destructive' });
      return;
    }

    const saleData = {
      customerId: customer?.id,
      items: cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        serialNumber: item.serialNumber,
      })),
      discount: discountAmount,
      tax: taxAmount,
      payments,
      notes,
    };

    createSaleMutation.mutate(saleData);
  };

  // Search customer by phone
  const searchCustomer = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const response = await fetch(`/api/customers/phone/${phone}`);
      if (response.ok) {
        const customerData = await response.json();
        setCustomer(customerData);
        toast({ title: 'Customer found!', description: `Welcome back, ${customerData.name}` });
      }
    } catch (error) {
      // Customer not found, that's okay
    }
  };

  // Auto-apply offers
  useEffect(() => {
    if (offers && cart.length > 0) {
      // Apply automatic offers based on cart contents
      // This is a simplified implementation
      offers.forEach((offer: any) => {
        if (offer.type === 'combo' && offer.isActive) {
          // Check if combo conditions are met
          // Apply discount or add free items
        }
      });
    }
  }, [cart, offers]);

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Product Search & Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Scan className="h-5 w-5 mr-2" />
                Product Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <Input
                  placeholder="Search by name, SKU, UPC, MPN, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Scan className="h-4 w-4" />
                </Button>
              </div>

              {/* Search Results */}
              {(searchResults?.length > 0 || barcodeResults?.products?.length > 0) && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {searchResults?.map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        {product.image && (
                          <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {product.sku} | Stock: {product.stock}
                          </p>
                          <p className="text-sm font-medium">৳{Number(product.sellingPrice).toLocaleString()}</p>
                        </div>
                      </div>
                      <Button onClick={() => addToCart(product)} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {barcodeResults?.products?.map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 bg-blue-50">
                      <div className="flex items-center space-x-3">
                        {product.image && (
                          <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <Badge variant="secondary">Barcode Match</Badge>
                          <p className="text-sm font-medium">৳{Number(product.sellingPrice).toLocaleString()}</p>
                        </div>
                      </div>
                      <Button onClick={() => addToCart(product)} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter customer phone number..."
                  onChange={(e) => searchCustomer(e.target.value)}
                />
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </div>
              
              {customer && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <Badge variant="secondary">
                      <Gift className="h-3 w-3 mr-1" />
                      {customer.loyaltyPoints} Points
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart & Checkout */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Cart ({cart.length})
                </span>
                <Button variant="outline" size="sm" onClick={() => setCart([])}>
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">৳{item.unitPrice} each</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 text-red-600"
                        onClick={() => updateQuantity(item.id, 0)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {cart.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals & Checkout */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="h-5 w-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{subtotal.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Discount:</span>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-16 h-8"
                      min="0"
                      max="100"
                    />
                    <Percent className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Tax:</span>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={tax}
                      onChange={(e) => setTax(Number(e.target.value))}
                      className="w-16 h-8"
                      min="0"
                      max="100"
                    />
                    <Percent className="h-4 w-4" />
                  </div>
                </div>

                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>৳{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Profit:</span>
                    <span>৳{totalProfit.toLocaleString()}</span>
                  </div>
                </div>

                <Textarea
                  placeholder="Order notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-3"
                />

                <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full" size="lg">
                      Proceed to Payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Payment Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold">৳{total.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setPayments([{ method: 'cash', amount: total }])}
                          >
                            <Banknote className="h-4 w-4 mr-2" />
                            Cash
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setPayments([{ method: 'bkash', amount: total }])}
                          >
                            <Smartphone className="h-4 w-4 mr-2" />
                            bKash
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setPayments([{ method: 'nagad', amount: total }])}
                          >
                            <Smartphone className="h-4 w-4 mr-2" />
                            Nagad
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setPayments([{ method: 'bank', amount: total }])}
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Bank
                          </Button>
                        </div>

                        {payments.length > 0 && (
                          <div className="space-y-2">
                            {payments.map((payment, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                                <span className="capitalize">{payment.method}</span>
                                <span>৳{payment.amount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handlePayment}
                        className="w-full"
                        disabled={createSaleMutation.isPending || payments.length === 0}
                      >
                        {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}