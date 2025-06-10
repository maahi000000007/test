import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Eye,
  Truck,
  DollarSign,
  Package,
  Calendar
} from 'lucide-react';

export default function PurchasesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // Fetch purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const response = await fetch('/api/purchases');
      if (!response.ok) throw new Error('Failed to fetch purchases');
      return response.json();
    },
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers');
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      return response.json();
    },
  });

  // Fetch products for purchase form
  const { data: products } = useQuery({
    queryKey: ['products-for-purchase'],
    queryFn: async () => {
      const response = await fetch('/api/products?active=true');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async (purchaseData: any) => {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData),
      });
      if (!response.ok) throw new Error('Failed to create purchase');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Purchase created successfully!' });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch purchase details
  const { data: purchaseDetails } = useQuery({
    queryKey: ['purchase-details', selectedPurchase?.id],
    queryFn: async () => {
      const response = await fetch(`/api/purchases/${selectedPurchase.id}`);
      if (!response.ok) throw new Error('Failed to fetch purchase details');
      return response.json();
    },
    enabled: !!selectedPurchase,
  });

  const PurchaseForm = ({ onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      supplierId: '',
      invoiceNumber: '',
      items: [{ productId: '', quantity: 1, unitCost: 0 }],
    });

    const addItem = () => {
      setFormData({
        ...formData,
        items: [...formData.items, { productId: '', quantity: 1, unitCost: 0 }]
      });
    };

    const removeItem = (index: number) => {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      });
    };

    const updateItem = (index: number, field: string, value: any) => {
      const updatedItems = formData.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      );
      setFormData({ ...formData, items: updatedItems });
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    const total = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier: any) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              placeholder="Supplier invoice number"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>

          {formData.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Select 
                  value={item.productId} 
                  onValueChange={(value) => updateItem(index, 'productId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                  placeholder="Qty"
                  min="1"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(e) => updateItem(index, 'unitCost', Number(e.target.value))}
                  placeholder="Unit Cost"
                  min="0"
                />
              </div>
              <div className="col-span-1">
                <p className="text-sm font-medium">
                  ৳{(item.quantity * item.unitCost).toLocaleString()}
                </p>
              </div>
              <div className="col-span-1">
                {formData.items.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total:</span>
            <span className="text-lg font-bold">৳{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createPurchaseMutation.isPending}>
            {createPurchaseMutation.isPending ? 'Creating...' : 'Create Purchase'}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
            <p className="text-muted-foreground">
              Manage supplier purchases and inventory restocking
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Purchase</DialogTitle>
              </DialogHeader>
              <PurchaseForm
                onSubmit={(data: any) => createPurchaseMutation.mutate(data)}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Purchases List */}
        <div className="grid gap-4">
          {purchases?.map((purchase: any) => (
            <Card key={purchase.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">
                          {purchase.supplier?.name || 'Unknown Supplier'}
                        </h3>
                        <Badge variant={purchase.status === 'completed' ? 'default' : 'secondary'}>
                          {purchase.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {purchase.invoiceNumber && `Invoice: ${purchase.invoiceNumber} • `}
                        {new Date(purchase.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        By: {purchase.user?.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-lg font-bold">৳{Number(purchase.total).toLocaleString()}</p>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-green-600">
                            Paid: ৳{Number(purchase.paid).toLocaleString()}
                          </span>
                          {Number(purchase.balance) > 0 && (
                            <span className="text-red-600">
                              Due: ৳{Number(purchase.balance).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPurchase(purchase)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Purchase Details Dialog */}
        <Dialog open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Details</DialogTitle>
            </DialogHeader>
            {purchaseDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Purchase Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Supplier:</span>
                        <span className="font-medium">{purchaseDetails.supplier?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Invoice Number:</span>
                        <span>{purchaseDetails.invoiceNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{new Date(purchaseDetails.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={purchaseDetails.status === 'completed' ? 'default' : 'secondary'}>
                          {purchaseDetails.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Payment Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-medium">৳{Number(purchaseDetails.total).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paid Amount:</span>
                        <span className="text-green-600">৳{Number(purchaseDetails.paid).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Balance:</span>
                        <span className={Number(purchaseDetails.balance) > 0 ? 'text-red-600' : 'text-green-600'}>
                          ৳{Number(purchaseDetails.balance).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Items</h3>
                  <div className="space-y-2">
                    {purchaseDetails.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          {item.product?.image && (
                            <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded" />
                          )}
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {item.product?.sku} | MPN: {item.product?.mpn}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {item.quantity} × ৳{Number(item.unitCost).toLocaleString()} = ৳{Number(item.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {purchases?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No purchases found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first purchase order
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}