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
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { 
  Monitor, 
  Plus, 
  Search, 
  Eye,
  ShoppingCart,
  Trash2,
  Save,
  Cpu,
  HardDrive,
  MemoryStick,
  Zap
} from 'lucide-react';

export default function PCBuilderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBuilderDialog, setShowBuilderDialog] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<any>(null);
  const [currentBuild, setCurrentBuild] = useState<any>({
    name: '',
    customerId: '',
    components: [],
    notes: '',
  });

  // Fetch PC builds
  const { data: builds, isLoading } = useQuery({
    queryKey: ['pc-builds'],
    queryFn: async () => {
      const response = await fetch('/api/pc-builder');
      if (!response.ok) throw new Error('Failed to fetch PC builds');
      return response.json();
    },
  });

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers-for-builder'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  // Fetch products for components
  const { data: products } = useQuery({
    queryKey: ['products-for-builder'],
    queryFn: async () => {
      const response = await fetch('/api/products?active=true');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Create/Update build mutation
  const saveBuildMutation = useMutation({
    mutationFn: async (buildData: any) => {
      const response = await fetch('/api/pc-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildData),
      });
      if (!response.ok) throw new Error('Failed to save build');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'PC build saved successfully!' });
      setShowBuilderDialog(false);
      setCurrentBuild({ name: '', customerId: '', components: [], notes: '' });
      queryClient.invalidateQueries({ queryKey: ['pc-builds'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Convert to sale mutation
  const convertToSaleMutation = useMutation({
    mutationFn: async (buildId: string) => {
      const response = await fetch(`/api/pc-builder/${buildId}/convert-to-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: [{ method: 'cash', amount: 0 }] // Will be calculated
        }),
      });
      if (!response.ok) throw new Error('Failed to convert to sale');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Build converted to sale successfully!' });
      queryClient.invalidateQueries({ queryKey: ['pc-builds'] });
      setSelectedBuild(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch build details
  const { data: buildDetails } = useQuery({
    queryKey: ['build-details', selectedBuild?.id],
    queryFn: async () => {
      const response = await fetch(`/api/pc-builder/${selectedBuild.id}`);
      if (!response.ok) throw new Error('Failed to fetch build details');
      return response.json();
    },
    enabled: !!selectedBuild,
  });

  const addComponent = () => {
    setCurrentBuild({
      ...currentBuild,
      components: [...currentBuild.components, { productId: '', quantity: 1, category: '' }]
    });
  };

  const removeComponent = (index: number) => {
    setCurrentBuild({
      ...currentBuild,
      components: currentBuild.components.filter((_: any, i: number) => i !== index)
    });
  };

  const updateComponent = (index: number, field: string, value: any) => {
    const updatedComponents = currentBuild.components.map((component: any, i: number) => 
      i === index ? { ...component, [field]: value } : component
    );
    setCurrentBuild({ ...currentBuild, components: updatedComponents });
  };

  const calculateTotal = () => {
    return currentBuild.components.reduce((total: number, component: any) => {
      const product = products?.find((p: any) => p.id === component.productId);
      return total + (product ? Number(product.sellingPrice) * component.quantity : 0);
    }, 0);
  };

  const getComponentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'cpu': case 'processor': return <Cpu className="h-4 w-4" />;
      case 'ram': case 'memory': return <MemoryStick className="h-4 w-4" />;
      case 'storage': case 'hdd': case 'ssd': return <HardDrive className="h-4 w-4" />;
      case 'psu': case 'power': return <Zap className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const PCBuilderForm = ({ onSubmit, onCancel }: any) => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (currentBuild.components.length === 0) {
        toast({ title: 'Error', description: 'Please add at least one component', variant: 'destructive' });
        return;
      }
      onSubmit(currentBuild);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Build Name *</Label>
            <Input
              id="name"
              value={currentBuild.name}
              onChange={(e) => setCurrentBuild({ ...currentBuild, name: e.target.value })}
              placeholder="e.g., Gaming PC, Office Build"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select 
              value={currentBuild.customerId} 
              onValueChange={(value) => setCurrentBuild({ ...currentBuild, customerId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer: any) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Components</Label>
            <Button type="button" variant="outline" size="sm" onClick={addComponent}>
              <Plus className="h-3 w-3 mr-1" />
              Add Component
            </Button>
          </div>

          {currentBuild.components.map((component: any, index: number) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Select 
                  value={component.productId} 
                  onValueChange={(value) => updateComponent(index, 'productId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component" />
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
                  value={component.quantity}
                  onChange={(e) => updateComponent(index, 'quantity', Number(e.target.value))}
                  placeholder="Qty"
                  min="1"
                />
              </div>
              <div className="col-span-2">
                <Input
                  value={component.category}
                  onChange={(e) => updateComponent(index, 'category', e.target.value)}
                  placeholder="Category"
                />
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium">
                  ৳{(() => {
                    const product = products?.find((p: any) => p.id === component.productId);
                    return product ? (Number(product.sellingPrice) * component.quantity).toLocaleString() : '0';
                  })()}
                </p>
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeComponent(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={currentBuild.notes}
            onChange={(e) => setCurrentBuild({ ...currentBuild, notes: e.target.value })}
            placeholder="Build specifications, compatibility notes, etc."
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total:</span>
            <span className="text-lg font-bold">৳{calculateTotal().toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveBuildMutation.isPending}>
            {saveBuildMutation.isPending ? 'Saving...' : 'Save Build'}
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
            <h1 className="text-3xl font-bold tracking-tight">PC Builder</h1>
            <p className="text-muted-foreground">
              Create custom PC builds and convert them to sales
            </p>
          </div>
          <Dialog open={showBuilderDialog} onOpenChange={setShowBuilderDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Build
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create PC Build</DialogTitle>
              </DialogHeader>
              <PCBuilderForm
                onSubmit={(data: any) => saveBuildMutation.mutate(data)}
                onCancel={() => {
                  setShowBuilderDialog(false);
                  setCurrentBuild({ name: '', customerId: '', components: [], notes: '' });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Builds List */}
        <div className="grid gap-4">
          {builds?.map((build: any) => (
            <Card key={build.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{build.name}</h3>
                        <Badge variant={build.status === 'purchased' ? 'default' : 'secondary'}>
                          {build.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        {build.customer && (
                          <span>Customer: {build.customer.name}</span>
                        )}
                        <span>{new Date(build.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-lg font-bold">৳{Number(build.total).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {build.components?.length || 0} components
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBuild(build)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {build.status === 'saved' && (
                          <Button
                            size="sm"
                            onClick={() => convertToSaleMutation.mutate(build.id)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Purchase
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Build Details Dialog */}
        <Dialog open={!!selectedBuild} onOpenChange={() => setSelectedBuild(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>PC Build Details</DialogTitle>
            </DialogHeader>
            {buildDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Build Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Name:</span>
                        <span className="font-medium">{buildDetails.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={buildDetails.status === 'purchased' ? 'default' : 'secondary'}>
                          {buildDetails.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(buildDetails.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-bold">৳{Number(buildDetails.total).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Customer Information</h3>
                    {buildDetails.customer ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Name:</span>
                          <span className="font-medium">{buildDetails.customer.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Phone:</span>
                          <span>{buildDetails.customer.phone}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No customer assigned</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Components</h3>
                  <div className="space-y-2">
                    {buildDetails.components?.map((component: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            {getComponentIcon(component.category || '')}
                          </div>
                          <div>
                            <p className="font-medium">{component.product?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {component.category && `${component.category} • `}
                              SKU: {component.product?.sku}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {component.quantity} × ৳{Number(component.product?.sellingPrice || 0).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            = ৳{(component.quantity * Number(component.product?.sellingPrice || 0)).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {buildDetails.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded">{buildDetails.notes}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  {buildDetails.status === 'saved' && (
                    <Button
                      onClick={() => convertToSaleMutation.mutate(buildDetails.id)}
                      disabled={convertToSaleMutation.isPending}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Convert to Sale
                    </Button>
                  )}
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

        {builds?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No PC builds found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first PC build to get started
            </p>
            <Button onClick={() => setShowBuilderDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Build
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}