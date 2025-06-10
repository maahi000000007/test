import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package,
  Calendar,
  Download,
  Target,
  DollarSign
} from 'lucide-react';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportType, setReportType] = useState('profit-loss');

  // Fetch profit/loss report
  const { data: profitLossData } = useQuery({
    queryKey: ['profit-loss-report', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        period: 'daily'
      });
      const response = await fetch(`/api/reports/profit-loss?${params}`);
      if (!response.ok) throw new Error('Failed to fetch profit/loss report');
      return response.json();
    },
  });

  // Fetch product performance report
  const { data: productPerformance } = useQuery({
    queryKey: ['product-performance', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: '10'
      });
      const response = await fetch(`/api/reports/product-performance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch product performance');
      return response.json();
    },
  });

  // Fetch customer analysis
  const { data: customerAnalysis } = useQuery({
    queryKey: ['customer-analysis', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: '10'
      });
      const response = await fetch(`/api/reports/customer-analysis?${params}`);
      if (!response.ok) throw new Error('Failed to fetch customer analysis');
      return response.json();
    },
  });

  // Fetch sales by user
  const { data: salesByUser } = useQuery({
    queryKey: ['sales-by-user', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const response = await fetch(`/api/reports/sales-by-user?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sales by user');
      return response.json();
    },
  });

  // Fetch inventory valuation
  const { data: inventoryValuation } = useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: async () => {
      const response = await fetch('/api/reports/inventory-valuation');
      if (!response.ok) throw new Error('Failed to fetch inventory valuation');
      return response.json();
    },
  });

  // Fetch seasonal trends
  const { data: seasonalTrends } = useQuery({
    queryKey: ['seasonal-trends'],
    queryFn: async () => {
      const response = await fetch('/api/reports/seasonal-trends');
      if (!response.ok) throw new Error('Failed to fetch seasonal trends');
      return response.json();
    },
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const renderProfitLossChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={profitLossData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="totalSales" stroke="#8884d8" name="Sales" />
        <Line type="monotone" dataKey="totalProfit" stroke="#82ca9d" name="Profit" />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderProductPerformanceChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={productPerformance?.slice(0, 5)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="productName" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="totalRevenue" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderSalesByUserChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={salesByUser}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ userName, percent }) => `${userName} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="totalSales"
        >
          {salesByUser?.map((entry: any, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive business insights and performance metrics
            </p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <Input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
                <span>to</span>
                <Input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit-loss">Profit & Loss</SelectItem>
                  <SelectItem value="product-performance">Product Performance</SelectItem>
                  <SelectItem value="customer-analysis">Customer Analysis</SelectItem>
                  <SelectItem value="inventory-valuation">Inventory Valuation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ৳{profitLossData?.reduce((sum: number, item: any) => sum + Number(item.totalSales || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ৳{profitLossData?.reduce((sum: number, item: any) => sum + Number(item.totalProfit || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ৳{Number(inventoryValuation?.summary?.totalCostValue || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerAnalysis?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {renderProfitLossChart()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {renderProductPerformanceChart()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales by User</CardTitle>
            </CardHeader>
            <CardContent>
              {renderSalesByUserChart()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seasonal Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={seasonalTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="totalSales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customerAnalysis?.slice(0, 5).map((customer: any, index: number) => (
                  <div key={customer.customerId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.orderCount} orders
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">৳{Number(customer.totalSpent).toLocaleString()}</p>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productPerformance?.slice(0, 5).map((product: any, index: number) => (
                  <div key={product.productId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{product.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.totalQuantity} units sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">৳{Number(product.totalRevenue).toLocaleString()}</p>
                      <p className="text-sm text-green-600">
                        ৳{Number(product.totalProfit).toLocaleString()} profit
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Performance by User */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Performance by User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesByUser?.map((user: any) => (
                <div key={user.userId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.orderCount} orders • Avg: ৳{Number(user.avgOrderValue).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">৳{Number(user.totalSales).toLocaleString()}</p>
                    <p className="text-sm text-green-600">
                      ৳{Number(user.totalProfit).toLocaleString()} profit
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}