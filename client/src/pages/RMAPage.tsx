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
  RefreshCw, 
  Plus, 
  Search, 
  Eye,
  Calendar,
  User,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

export default function RMAPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRMA, setSelectedRMA] = useState<any>(null);
  const [warrantyCheckSerial, setWarrantyCheckSerial] = useState('');

  // Fetch RMAs
  const { data: rmas, isLoading } = useQuery({
    queryKey: ['rmas'],
    queryFn: async () => {
      const response = await fetch('/api/rma');
      if (!response.ok) throw new Error('Failed to fetch RMAs');
      return response.json();
    },
  });

  // Fetch customers for RMA form
  const { data: customers } = useQuery({
    queryKey: ['customers-for-rma'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  // Fetch products for RMA form
  const { data: products } = useQuery({
    queryKey: ['products-for-rma'],
    queryFn: async () => {
      const response = await fetch('/api/products?active=true');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Create RMA mutation
  const createRMAMutation = useMutation({
    mutationFn: async (rmaData: any) => {
      const response = await fetch('/api/rma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rmaData),
      });
      if (!response.ok) throw new Error('Failed to create RMA');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'RMA created successfully!' });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['rmas'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update RMA status mutation
  const updateRMAMutation = useMutation({
    mutationFn: async ({ id, status, notes }: any) => {
      const response = await fetch(`/api/rma/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!response.ok) throw new Error('Failed to update RMA');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'RMA updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['rmas'] });
      setSelectedRMA(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Warranty check query
  const { data: warrantyInfo, refetch: checkWarranty } = useQuery({
    queryKey: ['warranty-check', warrantyCheckSerial],
    queryFn: async () => {
      const response = await fetch(`/api/rma/warranty-check/${warrantyCheckSerial}`);
      if (!response.ok) throw new Error('Failed to check warranty');
      return response.json();
    },
    enabled: false,
  });

  // Fetch RMA details
  const { data: rmaDetails } = useQuery({
    queryKey: ['rma-details', selectedRMA?.id],
    queryFn: async () => {
      const response = await fetch(`/api/rma/${selectedRMA.id}`);
      if (!response.ok) throw new Error('Failed to fetch RMA details');
      return response.json();
    },
    enabled: !!selectedRMA,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'under_review': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'repaired': return <RefreshCw className="h-4 w-4" />;
      case 'returned': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_review': return 'secondary';
      case 'approved': return 'default';
      case 'repaired': return 'default';
      case 'returned': return 'default';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const RMAForm = ({ onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      customerId: '',
      productId: '',
      serialNumber: '',
      reason: '',
      notes: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customer">Customer *</Label>
          <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
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

        <div className="space-y-2">
          <Label htmlFor="product">Product *</Label>
          <Select value={formData.productId} onValueChange={(value) => setFormData({ ...formData, productId: value })}>
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

        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number</Label>
          <Input
            id="serialNumber"
            value={formData.serialNumber}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            placeholder="Enter serial number if available"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Describe the issue or reason for return"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional information"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createRMAMutation.isPending}>
            {createRMAMutation.isPending ? 'Creating...' : 'Create RMA'}
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
            <h1 className="text-3xl font-bold tracking-tight">RMA & Returns</h1>
            <p className="text-muted-foreground">
              Manage product returns and warranty claims
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New RMA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New RMA</DialogTitle>
              </DialogHeader>
              <RMAForm
                onSubmit={(data: any) => createRMAMutation.mutate(data)}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Warranty Check */}
        <Card>
          <CardHeader>
            <CardTitle>Warranty Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Input
                placeholder="Enter serial number to check warranty..."
                value={warrantyCheckSerial}
                onChange={(e) => setWarrantyCheckSerial(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => checkWarranty()} disabled={!warrantyCheckSerial}>
                <Search className="h-4 w-4 mr-2" />
                Check
              </Button>
            </div>

            {warrantyInfo && (
              <div className="mt-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold">{warrantyInfo.product?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Serial: {warrantyInfo.serialNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Customer: {warrantyInfo.customer?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={warrantyInfo.isUnderWarranty ? 'default' : 'destructive'}>
                      {warrantyInfo.isUnderWarranty ? 'Under Warranty' : 'Warranty Expired'}
                    </Badge>
                    {warrantyInfo.isUnderWarranty && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {warrantyInfo.daysRemaining} days remaining
                      </p>
                    )}
                    {warrantyInfo.warrantyExpiry && (
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(warrantyInfo.warrantyExpiry).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RMA List */}
        <div className="grid gap-4">
          {rmas?.map((rma: any) => (
            <Card key={rma.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      {getStatusIcon(rma.status)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{rma.rmaNumber}</h3>
                        <Badge variant={getStatusColor(rma.status)}>
                          {rma.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {rma.customer?.name}
                        </div>
                        <div className="flex items-center">
                          <Package className="h-3 w-3 mr-1" />
                          {rma.product?.name}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(rma.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rma.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRMA(rma)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* RMA Details Dialog */}
        <Dialog open={!!selectedRMA} onOpenChange={() => setSelectedRMA(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>RMA Details</DialogTitle>
            </DialogHeader>
            {rmaDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">RMA Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>RMA Number:</span>
                        <span className="font-medium">{rmaDetails.rmaNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={getStatusColor(rmaDetails.status)}>
                          {rmaDetails.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(rmaDetails.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Updated:</span>
                        <span>{new Date(rmaDetails.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Customer & Product</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Customer:</span>
                        <span className="font-medium">{rmaDetails.customer?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span>{rmaDetails.customer?.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Product:</span>
                        <span className="font-medium">{rmaDetails.product?.name}</span>
                      </div>
                      {rmaDetails.serialNumber && (
                        <div className="flex justify-between">
                          <span>Serial:</span>
                          <span>{rmaDetails.serialNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {rmaDetails.warrantyInfo && (
                  <div>
                    <h3 className="font-semibold mb-3">Warranty Information</h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span>Warranty Status:</span>
                        <Badge variant={rmaDetails.warrantyInfo.isUnderWarranty ? 'default' : 'destructive'}>
                          {rmaDetails.warrantyInfo.isUnderWarranty ? 'Under Warranty' : 'Expired'}
                        </Badge>
                      </div>
                      {rmaDetails.warrantyInfo.warrantyExpiry && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Expires: {new Date(rmaDetails.warrantyInfo.warrantyExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Reason</h3>
                  <p className="text-sm bg-gray-50 p-3 rounded">{rmaDetails.reason}</p>
                </div>

                {rmaDetails.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded">{rmaDetails.notes}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  {rmaDetails.status === 'under_review' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => updateRMAMutation.mutate({ 
                          id: rmaDetails.id, 
                          status: 'approved',
                          notes: 'RMA approved for processing'
                        })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateRMAMutation.mutate({ 
                          id: rmaDetails.id, 
                          status: 'rejected',
                          notes: 'RMA rejected'
                        })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {rmaDetails.status === 'approved' && (
                    <Button
                      onClick={() => updateRMAMutation.mutate({ 
                        id: rmaDetails.id, 
                        status: 'repaired',
                        notes: 'Product repaired and ready for return'
                      })}
                    >
                      Mark as Repaired
                    </Button>
                  )}
                  {rmaDetails.status === 'repaired' && (
                    <Button
                      onClick={() => updateRMAMutation.mutate({ 
                        id: rmaDetails.id, 
                        status: 'returned',
                        notes: 'Product returned to customer'
                      })}
                    >
                      Mark as Returned
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

        {rmas?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No RMAs found</h3>
            <p className="text-muted-foreground mb-4">
              No return requests have been created yet
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create RMA
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}