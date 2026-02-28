/**
 * Generador de insights automáticos para reportes
 */

export interface Insight {
  type: 'warning' | 'info' | 'success' | 'error'
  title: string
  message: string
  metric?: string
  value?: number
}

/**
 * Analiza datos de rotación de inventario y genera insights
 */
export function analyzeInventoryRotation(data: any[]): Insight[] {
  const insights: Insight[] = []
  
  if (!data || data.length === 0) return insights
  
  // Calcular productos con baja rotación
  const lowRotation = data.filter(item => {
    const rotation = typeof item.rotation === 'number' ? item.rotation : parseFloat(item.rotation) || 0
    return rotation < 0.5 && item.currentStock > 0
  })
  
  const lowRotationPercent = (lowRotation.length / data.length) * 100
  
  if (lowRotationPercent > 30) {
    insights.push({
      type: 'warning',
      title: 'Alto Sobrestock',
      message: `${lowRotation.length} productos (${lowRotationPercent.toFixed(1)}%) tienen rotación menor a 0.5. Considere promociones o ajuste de inventario.`,
      metric: 'Productos con baja rotación',
      value: lowRotation.length
    })
  }
  
  // Productos sin movimiento
  const noMovement = data.filter(item => item.totalSold === 0 && item.currentStock > 0)
  
  if (noMovement.length > 0) {
    insights.push({
      type: 'error',
      title: 'Productos Sin Movimiento',
      message: `${noMovement.length} productos tienen stock pero no han tenido ventas en el período analizado.`,
      metric: 'Productos sin ventas',
      value: noMovement.length
    })
  }
  
  // Productos con alta rotación
  const highRotation = data.filter(item => {
    const rotation = typeof item.rotation === 'number' ? item.rotation : parseFloat(item.rotation) || 0
    return rotation > 2
  })
  
  if (highRotation.length > 0) {
    insights.push({
      type: 'success',
      title: 'Productos Estrella',
      message: `${highRotation.length} productos tienen excelente rotación (>2). Asegure disponibilidad de stock.`,
      metric: 'Productos de alta rotación',
      value: highRotation.length
    })
  }
  
  return insights
}

/**
 * Analiza márgenes de ganancia y genera insights
 */
export function analyzeProfitMargin(data: any[]): Insight[] {
  const insights: Insight[] = []
  
  if (!data || data.length === 0) return insights
  
  // Calcular margen promedio
  const avgMargin = data.reduce((sum, item) => {
    const margin = typeof item.marginPercent === 'number' ? item.marginPercent : parseFloat(item.marginPercent) || 0
    return sum + margin
  }, 0) / data.length
  
  if (avgMargin < 20) {
    insights.push({
      type: 'warning',
      title: 'Margen Bajo',
      message: `El margen promedio es ${avgMargin.toFixed(2)}%. Considere revisar precios o costos de productos.`,
      metric: 'Margen promedio',
      value: avgMargin
    })
  } else if (avgMargin > 40) {
    insights.push({
      type: 'success',
      title: 'Excelente Margen',
      message: `El margen promedio es ${avgMargin.toFixed(2)}%. Mantiene una rentabilidad saludable.`,
      metric: 'Margen promedio',
      value: avgMargin
    })
  }
  
  // Productos con margen negativo
  const negativeMargin = data.filter(item => {
    const margin = typeof item.marginPercent === 'number' ? item.marginPercent : parseFloat(item.marginPercent) || 0
    return margin < 0
  })
  
  if (negativeMargin.length > 0) {
    insights.push({
      type: 'error',
      title: 'Productos con Pérdida',
      message: `${negativeMargin.length} productos tienen margen negativo. Revise urgentemente precios de costo y venta.`,
      metric: 'Productos con pérdida',
      value: negativeMargin.length
    })
  }
  
  return insights
}

/**
 * Analiza deuda de clientes y genera insights
 */
export function analyzeClientsDebt(data: any[]): Insight[] {
  const insights: Insight[] = []
  
  if (!data || data.length === 0) return insights
  
  // Calcular deuda total
  const totalDebt = data.reduce((sum, item) => sum + (item.creditUsed || 0), 0)
  
  // Clientes con alta utilización de crédito
  const highUtilization = data.filter(item => {
    const util = typeof item.utilizationPercent === 'number' ? item.utilizationPercent : parseFloat(item.utilizationPercent) || 0
    return util > 80
  })
  
  if (highUtilization.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Clientes Cerca del Límite',
      message: `${highUtilization.length} clientes han utilizado más del 80% de su crédito. Monitoree pagos.`,
      metric: 'Clientes alta utilización',
      value: highUtilization.length
    })
  }
  
  // Clientes con cuotas vencidas
  const withOverdue = data.filter(item => (item.overdueInstallments || 0) > 0)
  const overduePercent = (withOverdue.length / data.length) * 100
  
  if (overduePercent > 30) {
    insights.push({
      type: 'error',
      title: 'Alerta Cobranza',
      message: `${withOverdue.length} clientes (${overduePercent.toFixed(1)}%) tienen cuotas vencidas. Intensifique gestión de cobranza.`,
      metric: 'Clientes con mora',
      value: withOverdue.length
    })
  } else if (withOverdue.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Cuotas Vencidas',
      message: `${withOverdue.length} clientes tienen cuotas vencidas. Realice seguimiento de cobranza.`,
      metric: 'Clientes con mora',
      value: withOverdue.length
    })
  }
  
  insights.push({
    type: 'info',
    title: 'Deuda Total',
    message: `La cartera total de crédito es S/ ${totalDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.`,
    metric: 'Deuda total',
    value: totalDebt
  })
  
  return insights
}

/**
 * Analiza ventas por categoría y genera insights
 */
export function analyzeSalesByCategory(data: any[]): Insight[] {
  const insights: Insight[] = []
  
  if (!data || data.length === 0) return insights
  
  // Calcular total de ingresos
  const totalRevenue = data.reduce((sum, item) => sum + (item.totalRevenue || item.totalIngresos || 0), 0)
  
  // Categoría dominante
  const topCategory = data[0]
  if (topCategory) {
    const topPercent = ((topCategory.totalRevenue || topCategory.totalIngresos || 0) / totalRevenue) * 100
    
    if (topPercent > 50) {
      insights.push({
        type: 'warning',
        title: 'Concentración Alta',
        message: `La categoría "${topCategory.category || topCategory.categoria}" representa ${topPercent.toFixed(1)}% de las ventas. Considere diversificar.`,
        metric: 'Concentración',
        value: topPercent
      })
    } else {
      insights.push({
        type: 'success',
        title: 'Buena Diversificación',
        message: `Las ventas están bien distribuidas entre categorías. La principal representa ${topPercent.toFixed(1)}%.`,
        metric: 'Categoría principal',
        value: topPercent
      })
    }
  }
  
  return insights
}

/**
 * Analiza flujo de caja y genera insights
 */
export function analyzeCashFlow(data: any[]): Insight[] {
  const insights: Insight[] = []
  
  if (!data || data.length === 0) return insights
  
  // Calcular ingresos y egresos
  const ingresos = data.filter(item => item.type === 'INGRESO').reduce((sum, item) => sum + (item.amount || 0), 0)
  const egresos = data.filter(item => item.type === 'EGRESO').reduce((sum, item) => sum + Math.abs(item.amount || 0), 0)
  const flujoNeto = ingresos - egresos
  
  if (flujoNeto < 0) {
    insights.push({
      type: 'error',
      title: 'Flujo Negativo',
      message: `Los egresos superan los ingresos en S/ ${Math.abs(flujoNeto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}. Revise gastos.`,
      metric: 'Flujo neto',
      value: flujoNeto
    })
  } else if (flujoNeto > 0) {
    insights.push({
      type: 'success',
      title: 'Flujo Positivo',
      message: `Flujo de caja positivo de S/ ${flujoNeto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}. Buena gestión financiera.`,
      metric: 'Flujo neto',
      value: flujoNeto
    })
  }
  
  // Ratio de egresos
  const egresoRatio = (egresos / ingresos) * 100
  
  if (egresoRatio > 70) {
    insights.push({
      type: 'warning',
      title: 'Gastos Elevados',
      message: `Los gastos representan ${egresoRatio.toFixed(1)}% de los ingresos. Busque oportunidades de optimización.`,
      metric: 'Ratio de gastos',
      value: egresoRatio
    })
  }
  
  return insights
}

/**
 * Función principal que genera insights según el tipo de reporte
 */
export function generateInsights(reportType: string, data: any[]): Insight[] {
  switch (reportType) {
    case 'inventory-rotation':
    case 'stock-rotation':
      return analyzeInventoryRotation(data)
    
    case 'profit-margin':
      return analyzeProfitMargin(data)
    
    case 'clients-debt':
    case 'clients-with-debt':
      return analyzeClientsDebt(data)
    
    case 'sales-by-category':
      return analyzeSalesByCategory(data)
    
    case 'cash-flow':
      return analyzeCashFlow(data)
    
    default:
      return []
  }
}
