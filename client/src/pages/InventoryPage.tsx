import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { 
  Warehouse, 
  AlertTriangle, 
  TrendingDown, 
  Package,
  Plus,
  Minus,
  Search,
  Calendar,
  Barcode
} from 'lucide-react';

export default function InventoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Fetch inventory summary
  const { data: summary } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/summary');
      if (!response.ok) throw new Error('Failed to fetch inventory summary');
      return response.json();
    },
  });

  // Fetch low stock items
  const { data: lowStockItems } = useQuery({
    queryKey: ['low-stock-items'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock');
      if (!response.ok) throw new Error('Failed to fetch low stock items');
      return response.json();
    },
  });

  // Fetch warranty expiring items
  const { data: warrantyExpiring } = useQuery({
    queryKey: ['warranty-expiring'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/warranty-expiring?days=30');
      if (!response.ok) throw new Error('Failed to fetch warranty expiring items');
      return response.json();
    },
  });

  // Stock adjustment mutation
  const adjustStockMutation = useMutation({
    mutationFn: async (adjustmentData: any) => {
      const response = await fetch('/api/inventory/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentData),
      });
      if (!response.ok) throw new Error('Failed to adjust stock');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Stock adjusted successfully!' });
      setShowAdjustDialog(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const StockAdjustmentForm = ({ product, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      adjustment: 0,
      reason: '',
      notes: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({
        productId: product.id,
        ...formData,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Product</Label>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">Current Stock: {product.stock}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment">Stock Adjustment</Label>
          <Input
            id="adjustment"
            type="number"
            value={formData.adjustment}
            onChange={(e) => setFormData({ ...formData, adjustment: Number(e.target.value) })}
            placeholder="Enter positive or negative number"
            required
          />
          <p className="text-xs text-muted-foreground">
            New stock will be: {product.stock + formData.adjustment}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Input
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="e.g., Damaged, Lost, Found, Recount"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={adjustStockMutation.isPending}>
            {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
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
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground">
              Monitor stock levels, track movements, and manage inventory
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalProducts || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ৳{Number(summary?.totalValue || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary?.lowStockCount || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary?.outOfStockCount || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems?.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50">
                    <div className="flex items-center space-x-3">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        <div className="flex items-center space-x-4 mt-1">
                          <Badge variant="destructive">
                            Stock: {item.stock}
                          </Badge>
                          <Badge variant="outline">
                            Min: {item.minStock}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(item);
                          setShowAdjustDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adjust
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No low stock items</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warranty Expiring Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-500" />
              Warranty Expiring Soon (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {warrantyExpiring?.length > 0 ? (
              <div className="space-y-3">
                {warrantyExpiring.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center space-x-3">
                      {item.product?.image && (
                        <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Serial: {item.serialNumber}
                        </p>
                        <p className="text-sm text-blue-600">
                          Expires: {new Date(item.warrantyExpiry).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {Math.ceil((new Date(item.warrantyExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No warranties expiring soon</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Adjustment Dialog */}
        <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock Level</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <StockAdjustmentForm
                product={selectedProduct}
                onSubmit={(data: any) => adjustStockMutation.mutate(data)}
                onCancel={() => {
                  setShowAdjustDialog(false);
                  setSelectedProduct(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}