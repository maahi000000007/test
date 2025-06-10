import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';
import { Package, Plus, Search, Edit, Trash2, Eye, AlertTriangle, Barcode, Image as ImageIcon, FolderSync as Sync } from 'lucide-react';

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/products/categories/all');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  // Create/Update product mutation
  const saveProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      
      if (!response.ok) throw new Error('Failed to save product');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: `Product ${editingProduct ? 'updated' : 'created'} successfully!` });
      setShowAddDialog(false);
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Product deleted successfully!' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const ProductForm = ({ product, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      name: product?.name || '',
      description: product?.description || '',
      mpn: product?.mpn || '',
      sku: product?.sku || '',
      upc: product?.upc || '',
      categoryId: product?.categoryId || '',
      costPrice: product?.costPrice || '',
      sellingPrice: product?.sellingPrice || '',
      stock: product?.stock || 0,
      minStock: product?.minStock || 0,
      image: product?.image || '',
      isActive: product?.isActive ?? true,
      hasVariants: product?.hasVariants || false,
      warrantyMonths: product?.warrantyMonths || 0,
      openCartSync: product?.openCartSync || false,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mpn">MPN</Label>
            <Input
              id="mpn"
              value={formData.mpn}
              onChange={(e) => setFormData({ ...formData, mpn: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="upc">UPC/Barcode</Label>
            <Input
              id="upc"
              value={formData.upc}
              onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="costPrice">Cost Price *</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sellingPrice">Selling Price *</Label>
            <Input
              id="sellingPrice"
              type="number"
              step="0.01"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stock">Current Stock</Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="minStock">Minimum Stock</Label>
            <Input
              id="minStock"
              type="number"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="warrantyMonths">Warranty (Months)</Label>
            <Input
              id="warrantyMonths"
              type="number"
              value={formData.warrantyMonths}
              onChange={(e) => setFormData({ ...formData, warrantyMonths: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Image URL</Label>
          <Input
            id="image"
            value={formData.image}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="hasVariants"
              checked={formData.hasVariants}
              onCheckedChange={(checked) => setFormData({ ...formData, hasVariants: checked })}
            />
            <Label htmlFor="hasVariants">Has Variants</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="openCartSync"
              checked={formData.openCartSync}
              onCheckedChange={(checked) => setFormData({ ...formData, openCartSync: checked })}
            />
            <Label htmlFor="openCartSync">OpenCart Sync</Label>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveProductMutation.isPending}>
            {saveProductMutation.isPending ? 'Saving...' : (product ? 'Update' : 'Create')}
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
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product inventory and catalog
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Sync className="h-4 w-4 mr-2" />
              Sync OpenCart
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                </DialogHeader>
                <ProductForm
                  onSubmit={(data: any) => saveProductMutation.mutate(data)}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search products by name, MPN, SKU, UPC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products?.map((product: any) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square relative bg-gray-100">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                {product.stock <= product.minStock && (
                  <Badge variant="destructive" className="absolute top-2 left-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low Stock
                  </Badge>
                )}
                
                {!product.isActive && (
                  <Badge variant="secondary" className="absolute top-2 right-2">
                    Inactive
                  </Badge>
                )}
              </div>
              
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Stock: {product.stock}</span>
                    <span>SKU: {product.sku}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Cost: ৳{Number(product.costPrice).toLocaleString()}</p>
                      <p className="font-semibold">Price: ৳{Number(product.sellingPrice).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600">
                        Profit: ৳{(Number(product.sellingPrice) - Number(product.costPrice)).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(((Number(product.sellingPrice) - Number(product.costPrice)) / Number(product.sellingPrice)) * 100)}% margin
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProduct(product);
                        setShowAddDialog(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProductMutation.mutate(product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Barcode className="h-3 w-3" />
                    </Button>
                    {product.openCartSync && (
                      <Badge variant="outline" className="text-xs">
                        <Sync className="h-2 w-2 mr-1" />
                        Synced
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <ProductForm
                product={editingProduct}
                onSubmit={(data: any) => saveProductMutation.mutate(data)}
                onCancel={() => setEditingProduct(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {products?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedCategory ? 'Try adjusting your search filters' : 'Get started by adding your first product'}
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}