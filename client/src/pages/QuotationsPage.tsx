import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { useToast } from '../hooks/use-toast';
import { 
  FileText, 
  Plus, 
  Eye,
  Send,
  Download,
  ShoppingCart,
  Calendar,
  User
} from 'lucide-react';

export default function QuotationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);

  // Fetch quotations
  const { data: quotations, isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const response = await fetch('/api/quotations');
      if (!response.ok) throw new Error('Failed to fetch quotations');
      return response.json();
    },
  });

  // Fetch quotation details
  const { data: quotationDetails } = useQuery({
    queryKey: ['quotation-details', selectedQuotation?.id],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${selectedQuotation.id}`);
      if (!response.ok) throw new Error('Failed to fetch quotation details');
      return response.json();
    },
    enabled: !!selectedQuotation,
  });

  // Convert to sale mutation
  const convertToSaleMutation = useMutation({
    mutationFn: async ({ quotationId, payments }: any) => {
      const response = await fetch(`/api/quotations/${quotationId}/convert-to-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments }),
      });
      if (!response.ok) throw new Error('Failed to convert quotation to sale');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Quotation converted to sale successfully!' });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSelectedQuotation(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'approved': return 'default';
      case 'converted': return 'default';
      case 'expired': return 'destructive';
      default: return 'secondary';
    }
  };

  const isExpired = (expiryDate: string) => {
    return expiryDate && new Date(expiryDate) < new Date();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
            <p className="text-muted-foreground">
              Create and manage customer quotations
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Quotation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Quotation</DialogTitle>
              </DialogHeader>
              <div className="p-4">
                <p className="text-muted-foreground">Quotation creation form would go here...</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quotations List */}
        <div className="grid gap-4">
          {quotations?.map((quotation: any) => (
            <Card key={quotation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{quotation.quoteNumber}</h3>
                        <Badge variant={getStatusColor(quotation.status)}>
                          {quotation.status}
                        </Badge>
                        {isExpired(quotation.expiryDate) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        {quotation.customer && (
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {quotation.customer.name}
                          </div>
                        )}
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(quotation.createdAt).toLocaleDateString()}
                        </div>
                        {quotation.expiryDate && (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            Expires: {new Date(quotation.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-lg font-bold">৳{Number(quotation.total).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {quotation.user?.name}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedQuotation(quotation)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {quotation.status === 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => convertToSaleMutation.mutate({ 
                              quotationId: quotation.id,
                              payments: [{ method: 'cash', amount: Number(quotation.total) }]
                            })}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Convert
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

        {/* Quotation Details Dialog */}
        <Dialog open={!!selectedQuotation} onOpenChange={() => setSelectedQuotation(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quotation Details</DialogTitle>
            </DialogHeader>
            {quotationDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Quotation Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Quote Number:</span>
                        <span className="font-medium">{quotationDetails.quoteNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={getStatusColor(quotationDetails.status)}>
                          {quotationDetails.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(quotationDetails.createdAt).toLocaleDateString()}</span>
                      </div>
                      {quotationDetails.expiryDate && (
                        <div className="flex justify-between">
                          <span>Expires:</span>
                          <span className={isExpired(quotationDetails.expiryDate) ? 'text-red-600' : ''}>
                            {new Date(quotationDetails.expiryDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Customer Information</h3>
                    {quotationDetails.customer ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Name:</span>
                          <span className="font-medium">{quotationDetails.customer.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Phone:</span>
                          <span>{quotationDetails.customer.phone}</span>
                        </div>
                        {quotationDetails.customer.email && (
                          <div className="flex justify-between">
                            <span>Email:</span>
                            <span>{quotationDetails.customer.email}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Walk-in customer</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Items</h3>
                  <div className="space-y-2">
                    {quotationDetails.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          {item.product?.image && (
                            <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded" />
                          )}
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {item.product?.sku}
                            </p>
                            {item.isOptional && (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {item.quantity} × ৳{Number(item.unitPrice).toLocaleString()} = ৳{Number(item.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>৳{Number(quotationDetails.subtotal).toLocaleString()}</span>
                    </div>
                    {Number(quotationDetails.discount) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Discount:</span>
                        <span>-৳{Number(quotationDetails.discount).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(quotationDetails.tax) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>৳{Number(quotationDetails.tax).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>৳{Number(quotationDetails.total).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {quotationDetails.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                      {quotationDetails.notes}
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Send WhatsApp
                  </Button>
                  {quotationDetails.status === 'approved' && (
                    <Button
                      onClick={() => convertToSaleMutation.mutate({ 
                        quotationId: quotationDetails.id,
                        payments: [{ method: 'cash', amount: Number(quotationDetails.total) }]
                      })}
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

        {quotations?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quotations found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first quotation to get started
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Quotation
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}