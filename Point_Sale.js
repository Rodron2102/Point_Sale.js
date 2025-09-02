
import React, { useState, useEffect } from "react";
import { Product } from "@/entities/Product";
import { Category } from "@/entities/Category";
import { Sale } from "@/entities/Sale";
import { Customer } from "@/entities/Customer";
import { ShoppingCart, Plus, Minus, Search, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ProductGrid from "../components/pos/ProductGrid";
import ShoppingCartPanel from "../components/pos/ShoppingCartPanel";
import PaymentModal from "../components/pos/PaymentModal";

export default function PointOfSale() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedCategories] = await Promise.all([
        Product.filter({ active: true }),
        Category.filter({ active: true })
      ]);
      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) return prevCart;
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const updateCartQuantity = (productId, newQuantity) => {
    const product = products.find(p => p.id === productId);
    if (newQuantity > product.stock) return;

    setCart(prevCart =>
      newQuantity === 0
        ? prevCart.filter(item => item.id !== productId)
        : prevCart.map(item =>
            item.id === productId
              ? { ...item, quantity: newQuantity }
              : item
          )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleSaleComplete = async (saleData) => {
    try {
      // Crear la venta
      const receiptNumber = `REC-${Date.now()}`;
      const saleItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      await Sale.create({
        ...saleData,
        items: saleItems,
        total_amount: calculateTotal(),
        receipt_number: receiptNumber
      });

      // Actualizar inventario
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        await Product.update(item.id, {
          stock: product.stock - item.quantity
        });
      }

      // Actualizar datos del cliente si existe
      if (saleData.customer_name) {
        const existingCustomer = await Customer.filter({ name: saleData.customer_name });
        if (existingCustomer.length > 0) {
          const customer = existingCustomer[0];
          await Customer.update(customer.id, {
            total_purchases: (customer.total_purchases || 0) + calculateTotal(),
            visit_count: (customer.visit_count || 0) + 1,
            last_purchase_date: new Date().toISOString().split('T')[0]
          });
        } else {
          await Customer.create({
            name: saleData.customer_name,
            phone: saleData.customer_phone || '',
            total_purchases: calculateTotal(),
            visit_count: 1,
            last_purchase_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      clearCart();
      loadData(); // Changed from loadProducts to loadData to refresh categories too if needed
      setShowPaymentModal(false);
      
      // Aquí podrías mostrar el recibo o una confirmación
      alert(`Venta completada! Recibo: ${receiptNumber}`);
    } catch (error) {
      console.error("Error completing sale:", error);
      alert("Error al procesar la venta");
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "todos" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryOptions = ["todos", ...categories.map(cat => cat.name)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            Punto de Venta
          </h1>
          <p className="text-slate-600">Gestiona tus ventas de forma rápida y eficiente</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel de productos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barra de búsqueda y filtros */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-slate-200 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mt-4">
                  <TabsList 
                    className="grid w-full auto-cols-fr bg-slate-100" 
                    style={{ gridTemplateColumns: `repeat(${Math.min(categoryOptions.length, 7)}, minmax(0, 1fr))` }}
                  >
                    {categoryOptions.slice(0, 7).map((category) => (
                      <TabsTrigger 
                        key={category} 
                        value={category}
                        className="text-xs sm:text-sm capitalize data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        {category}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Grid de productos */}
            <ProductGrid
              products={filteredProducts}
              onAddToCart={addToCart}
              isLoading={isLoading}
            />
          </div>

          {/* Panel del carrito */}
          <div className="lg:col-span-1">
            <ShoppingCartPanel
              cart={cart}
              onUpdateQuantity={updateCartQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              total={calculateTotal()}
              onProceedToPayment={() => setShowPaymentModal(true)}
            />
          </div>
        </div>

        {/* Modal de pago */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          total={calculateTotal()}
          onSaleComplete={handleSaleComplete}
          cart={cart}
        />
      </div>
    </div>
  );
}

