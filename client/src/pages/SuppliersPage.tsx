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
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Eye,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

export default function SuppliersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  // Fetch suppliers
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/suppliers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      return response.json();
    },
  });

  // Fetch suppliers with outstanding balances
  const { data: outstandingBalances } = useQuery({
    queryKey: ['outstanding-balances'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers/reports/outstanding-balances');
      if (!response.ok) throw new Error('Failed to fetch outstanding balances');
      return response.json();
    },
  });

  // Create/Update supplier mutation
  const saveSupplierMutation = useMutation({
    mutationFn: async (supplierData: any) => {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData),
      });
      
      if (!response.ok) throw new Error('Failed to save supplier');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: `Supplier ${editingSupplier ? 'updated' : 'created'} successfully!` });
      setShowAddDialog(false);
      setEditingSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch supplier details
  const { data: supplierDetails } = useQuery({
    queryKey: ['supplier-details', selectedSupplier?.id],
    queryFn: async () => {
      const response = await fetch(`/api/suppliers/${selectedSupplier.id}`);
      if (!response.ok) throw new Error('Failed to fetch supplier details');
      return response.json();
    },
    enabled: !!selectedSupplier,
  });

  const SupplierForm = ({ supplier, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      name: supplier?.name || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Supplier Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveSupplierMutation.isPending}>
            {saveSupplierMutation.isPending ? 'Saving...' : (supplier ? 'Update' : 'Create')}
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
            <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground">
              Manage your supplier relationships and purchase history
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
              </DialogHeader>
              <SupplierForm
                onSubmit={(data: any) => saveSupplierMutation.mutate(data)}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Outstanding Balances Alert */}
        {outstandingBalances?.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Outstanding Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {outstandingBalances.slice(0, 3).map((supplier: any) => (
                  <div key={supplier.id} className="flex items-center justify-between">
                    <span className="font-medium">{supplier.name}</span>
                    <Badge variant="destructive">
                      ৳{Number(supplier.balance).toLocaleString()} due
                    </Badge>
                  </div>
                ))}
                {outstandingBalances.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    +{outstandingBalances.length - 3} more suppliers with outstanding balances
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search suppliers by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Suppliers List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers?.map((supplier: any) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{supplier.name}</h3>
                      {supplier.phone && (
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Mail className="h-3 w-3 mr-1" />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSupplier(supplier)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setShowAddDialog(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {supplier.address && (
                    <div className="flex items-start text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center text-sm">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Balance:
                    </div>
                    <Badge variant={Number(supplier.balance) > 0 ? 'destructive' : 'secondary'}>
                      ৳{Number(supplier.balance || 0).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Supplier Details Dialog */}
        <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Supplier Details</DialogTitle>
            </DialogHeader>
            {supplierDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg">{supplierDetails.name}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground mt-2">
                      {supplierDetails.phone && (
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-2" />
                          {supplierDetails.phone}
                        </div>
                      )}
                      {supplierDetails.email && (
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-2" />
                          {supplierDetails.email}
                        </div>
                      )}
                      {supplierDetails.address && (
                        <div className="flex items-start">
                          <MapPin className="h-3 w-3 mr-2 mt-0.5" />
                          {supplierDetails.address}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">
                        ৳{Number(supplierDetails.stats?.totalPurchases || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Purchases</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="font-semibold text-green-600">
                          ৳{Number(supplierDetails.stats?.totalPaid || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Paid</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <p className="font-semibold text-red-600">
                          ৳{Number(supplierDetails.balance || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Balance</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Recent Purchases</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {supplierDetails.purchaseHistory?.map((purchase: any) => (
                      <div key={purchase.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">
                            {purchase.invoiceNumber || `Purchase #${purchase.id.slice(-8)}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(purchase.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">৳{Number(purchase.total).toLocaleString()}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant={purchase.status === 'completed' ? 'default' :  'secondary'}>
                              {purchase.status}
                            </Badge>
                            {Number(purchase.balance) > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                ৳{Number(purchase.balance).toLocaleString()} due
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Supplier Dialog */}
        <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
            </DialogHeader>
            {editingSupplier && (
              <SupplierForm
                supplier={editingSupplier}
                onSubmit={(data: any) => saveSupplierMutation.mutate(data)}
                onCancel={() => setEditingSupplier(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {suppliers?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No suppliers found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search query' : 'Get started by adding your first supplier'}
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}