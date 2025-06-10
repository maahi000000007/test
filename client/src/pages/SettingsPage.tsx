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
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Users, Plus, Edit, Trash2, Shield, Bell, Database, FolderSync as Sync } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Fetch users (admin only)
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/auth/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Create/Update user mutation
  const saveUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const url = editingUser ? `/api/auth/users/${editingUser.id}` : '/api/auth/register';
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) throw new Error('Failed to save user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: `User ${editingUser ? 'updated' : 'created'} successfully!` });
      setShowAddUserDialog(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const UserForm = ({ user: formUser, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      name: formUser?.name || '',
      email: formUser?.email || '',
      phone: formUser?.phone || '',
      role: formUser?.role || 'staff',
      isActive: formUser?.isActive ?? true,
      password: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const submitData = { ...formData };
      if (formUser && !submitData.password) {
        delete submitData.password; // Don't update password if not provided
      }
      onSubmit(submitData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
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
          <Label htmlFor="role">Role *</Label>
          <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{formUser ? 'New Password (leave blank to keep current)' : 'Password *'}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!formUser}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveUserMutation.isPending}>
            {saveUserMutation.isPending ? 'Saving...' : (formUser ? 'Update' : 'Create')}
          </Button>
        </div>
      </form>
    );
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'staff': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage system settings and user accounts
            </p>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="grid gap-6">
          {/* User Management (Admin Only) */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    User Management
                  </CardTitle>
                  <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                      </DialogHeader>
                      <UserForm
                        onSubmit={(data: any) => saveUserMutation.mutate(data)}
                        onCancel={() => setShowAddUserDialog(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users?.map((userItem: any) => (
                    <div key={userItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                          <span className="font-medium">
                            {userItem.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{userItem.name}</p>
                          <p className="text-sm text-muted-foreground">{userItem.email}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={getRoleBadgeVariant(userItem.role)}>
                              {userItem.role}
                            </Badge>
                            <Badge variant={userItem.isActive ? 'default' : 'secondary'}>
                              {userItem.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(userItem);
                            setShowAddUserDialog(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Backup</p>
                  <p className="text-sm text-muted-foreground">Automatically backup data daily</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Low Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">Send notifications when stock is low</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send email alerts for important events</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* OpenCart Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sync className="h-5 w-5 mr-2" />
                OpenCart Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opencart-url">OpenCart URL</Label>
                  <Input
                    id="opencart-url"
                    placeholder="https://your-store.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter API key"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Sync Products</p>
                  <p className="text-sm text-muted-foreground">Automatically sync product data</p>
                </div>
                <Switch />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Separate Stock Management</p>
                  <p className="text-sm text-muted-foreground">Keep POS and website stock separate</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <Button variant="outline">
                <Sync className="h-4 w-4 mr-2" />
                Test Connection
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Warranty Expiry Alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when warranties are about to expire</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Due Reminders</p>
                  <p className="text-sm text-muted-foreground">Remind about pending payments</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sales Target Notifications</p>
                  <p className="text-sm text-muted-foreground">Notify about sales target progress</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Database Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Database Size</p>
                  <p className="text-sm text-muted-foreground">Current database size: 45.2 MB</p>
                </div>
                <Button variant="outline" size="sm">
                  Optimize
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Last Backup</p>
                  <p className="text-sm text-muted-foreground">Yesterday at 2:00 AM</p>
                </div>
                <Button variant="outline" size="sm">
                  Backup Now
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Data Export</p>
                  <p className="text-sm text-muted-foreground">Export all data for backup</p>
                </div>
                <Button variant="outline" size="sm">
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <UserForm
                user={editingUser}
                onSubmit={(data: any) => saveUserMutation.mutate(data)}
                onCancel={() => setEditingUser(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </Layout>
  );
}