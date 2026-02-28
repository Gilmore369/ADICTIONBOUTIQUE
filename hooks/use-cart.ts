'use client'

import { useState, useCallback } from 'react'

export interface CartItem {
  product_id: string
  product_name: string
  barcode: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
}

export function useCart() {
  const [cart, setCart] = useState<CartState>({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0
  })

  // Calculate totals
  const calculateTotals = useCallback((items: CartItem[], discount: number = 0) => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const total = subtotal - discount
    return { subtotal, total }
  }, [])

  // Add item to cart
  const addItem = useCallback((product: {
    id: string
    name: string
    barcode: string
    price: number
  }, quantity: number = 1) => {
    setCart(prev => {
      // Check if item already exists
      const existingIndex = prev.items.findIndex(item => item.product_id === product.id)
      
      let newItems: CartItem[]
      if (existingIndex >= 0) {
        // Update existing item quantity
        newItems = [...prev.items]
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
          subtotal: (newItems[existingIndex].quantity + quantity) * newItems[existingIndex].unit_price
        }
      } else {
        // Add new item
        const newItem: CartItem = {
          product_id: product.id,
          product_name: product.name,
          barcode: product.barcode,
          quantity,
          unit_price: product.price,
          subtotal: quantity * product.price
        }
        newItems = [...prev.items, newItem]
      }

      const { subtotal, total } = calculateTotals(newItems, prev.discount)
      return {
        ...prev,
        items: newItems,
        subtotal,
        total
      }
    })
  }, [calculateTotals])

  // Remove item from cart
  const removeItem = useCallback((product_id: string) => {
    setCart(prev => {
      const newItems = prev.items.filter(item => item.product_id !== product_id)
      const { subtotal, total } = calculateTotals(newItems, prev.discount)
      return {
        ...prev,
        items: newItems,
        subtotal,
        total
      }
    })
  }, [calculateTotals])

  // Update item quantity
  const updateQuantity = useCallback((product_id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(product_id)
      return
    }

    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.product_id === product_id) {
          return {
            ...item,
            quantity,
            subtotal: quantity * item.unit_price
          }
        }
        return item
      })

      const { subtotal, total } = calculateTotals(newItems, prev.discount)
      return {
        ...prev,
        items: newItems,
        subtotal,
        total
      }
    })
  }, [calculateTotals, removeItem])

  // Update discount
  const updateDiscount = useCallback((discount: number) => {
    setCart(prev => {
      const { total } = calculateTotals(prev.items, discount)
      return {
        ...prev,
        discount,
        total
      }
    })
  }, [calculateTotals])

  // Clear cart
  const clearCart = useCallback(() => {
    setCart({
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0
    })
  }, [])

  return {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    updateDiscount,
    clearCart
  }
}
