# 🛍️ Adiction Boutique - Sistema de Gestión Integral

Sistema completo de gestión para boutique de moda con punto de venta, inventario, CRM, cobranzas y reportes analíticos.

## 🚀 Características Principales

### 📦 Gestión de Inventario
- **Catálogos Completos**: Líneas, Categorías, Marcas, Tallas y Proveedores
- **Ingreso Masivo**: Registro rápido de productos con variantes por talla
- **Control de Stock**: Seguimiento en tiempo real por tienda
- **Movimientos**: Historial completo de entradas y salidas
- **Kardex**: Valorización de inventario

### 💰 Punto de Venta (POS)
- Interfaz rápida y moderna
- Ventas al contado y a crédito
- Generación automática de tickets
- Múltiples métodos de pago
- Soporte para múltiples tiendas

### 👥 CRM y Gestión de Clientes
- Perfiles completos de clientes
- Sistema de calificación (A, B, C, D)
- Historial de compras y pagos
- Geolocalización de clientes
- Seguimiento de visitas
- Sistema de referencias

### 💳 Gestión de Crédito y Cobranzas
- Planes de pago personalizados
- Calendario de cuotas
- Acciones de cobranza automatizadas
- Alertas de vencimiento
- Reportes de morosidad
- Gestión de devoluciones

### 📊 Reportes y Analytics
- Dashboard en tiempo real
- Reportes de ventas por período
- Análisis de productos más vendidos
- Métricas de clientes
- Reportes de cobranza
- Exportación a Excel/PDF

### 💵 Gestión de Caja
- Apertura y cierre de turnos
- Control de efectivo
- Conciliación automática
- Historial de movimientos
- Soporte multi-tienda

### 🗺️ Mapa de Clientes
- Visualización geográfica
- Rutas de cobranza optimizadas
- Filtros por estado de deuda
- Información contextual

## 🛠️ Tecnologías

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes, Server Actions
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Estilos**: Tailwind CSS 4
- **UI Components**: Radix UI, shadcn/ui
- **Mapas**: Google Maps API
- **Gráficos**: Recharts
- **PDF**: jsPDF, html2pdf
- **Validación**: Zod
- **Testing**: Playwright

## 📋 Requisitos Previos

- Node.js 18 o superior
- npm o yarn
- Cuenta de Supabase
- Cuenta de Google Cloud (para Maps API)

## 🔧 Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/Gilmore369/ADICTIONBOUTIQUE.git
cd ADICTIONBOUTIQUE
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.local.example .env.local
```

Editar `.env.local` con tus credenciales:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_google_maps_key
```

4. Ejecutar migraciones de base de datos:
```bash
# Las migraciones están en /supabase/migrations/
# Ejecutarlas en orden cronológico en tu proyecto de Supabase
```

5. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

6. Abrir en el navegador:
```
http://localhost:3000
```

## 📁 Estructura del Proyecto

```
├── app/                      # App Router de Next.js
│   ├── (auth)/              # Rutas protegidas
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── catalogs/        # Gestión de catálogos
│   │   ├── inventory/       # Inventario y stock
│   │   ├── clients/         # CRM de clientes
│   │   ├── pos/             # Punto de venta
│   │   ├── cash/            # Gestión de caja
│   │   ├── debt/            # Planes de crédito
│   │   ├── collections/     # Cobranzas
│   │   ├── reports/         # Reportes
│   │   └── map/             # Mapa de clientes
│   ├── (public)/            # Rutas públicas
│   └── api/                 # API Routes
├── components/              # Componentes React
│   ├── ui/                  # Componentes base
│   ├── catalogs/            # Componentes de catálogos
│   ├── clients/             # Componentes de clientes
│   ├── dashboard/           # Componentes del dashboard
│   └── ...
├── actions/                 # Server Actions
├── lib/                     # Utilidades y helpers
│   ├── supabase/           # Cliente de Supabase
│   ├── services/           # Servicios de negocio
│   ├── pdf/                # Generación de PDFs
│   └── reports/            # Lógica de reportes
├── supabase/               # Configuración de Supabase
│   └── migrations/         # Migraciones SQL
└── tests/                  # Tests E2E con Playwright
```

## 🔐 Seguridad

- Autenticación mediante Supabase Auth
- Row Level Security (RLS) en todas las tablas
- Validación de datos con Zod
- Sanitización de inputs
- Protección CSRF
- Rate limiting en APIs críticas

## 📱 Características Responsive

- Diseño adaptable a móviles, tablets y desktop
- Optimizado para uso en tienda física
- Interfaz táctil amigable

## 🧪 Testing

Ejecutar tests E2E:
```bash
npm run test:e2e
```

## 📈 Roadmap

- [ ] App móvil nativa (React Native)
- [ ] Integración con pasarelas de pago
- [ ] Sistema de facturación electrónica
- [ ] Módulo de compras a proveedores
- [ ] Dashboard de BI avanzado
- [ ] Integración con WhatsApp Business
- [ ] Sistema de fidelización

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y propietario.

## 👨‍💻 Autor

**Gilmore369**

## 📞 Soporte

Para soporte, por favor abre un issue en GitHub.

---

⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub
