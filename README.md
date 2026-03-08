# Adiction Boutique - Sistema de Gestión

Sistema completo de gestión para boutique de ropa desarrollado con Next.js 16 y Supabase.

## 🚀 Características Principales

### Módulos Implementados

- **Dashboard**: Métricas en tiempo real del negocio
- **Catálogos**: Gestión completa de productos, líneas, categorías, marcas, tallas y proveedores
- **Inventario**: Control de stock, movimientos y entrada masiva de productos
- **Punto de Venta (POS)**: Sistema de ventas con soporte para contado y crédito
- **Clientes**: CRM con gestión de créditos, historial y calificación
- **Cobranzas**: Sistema de seguimiento de pagos y acciones de cobranza
- **Deuda**: Gestión de planes de crédito y cuotas
- **Caja**: Control de turnos y movimientos de efectivo
- **Reportes**: Análisis de ventas, inventario y clientes
- **Mapa**: Visualización geográfica de clientes

### Características Técnicas

- ✅ **Next.js 16** con App Router
- ✅ **Supabase** para base de datos y autenticación
- ✅ **TypeScript** para type safety
- ✅ **Tailwind CSS** para estilos
- ✅ **React Query** para gestión de estado
- ✅ **Zod** para validación de datos
- ✅ **Row Level Security (RLS)** implementado
- ✅ **Multi-tienda** con soporte para múltiples ubicaciones
- ✅ **Sistema de roles** (Admin, Vendedor)

## 📋 Requisitos Previos

- Node.js 18 o superior
- npm o yarn
- Cuenta de Supabase

## 🛠️ Instalación

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

Editar `.env.local` con tus credenciales de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

4. Ejecutar migraciones de base de datos:
```bash
# Conectar a tu proyecto de Supabase y ejecutar las migraciones en /supabase/migrations
```

5. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

6. Abrir [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
supa/
├── actions/          # Server Actions de Next.js
├── app/             # App Router de Next.js
│   ├── (auth)/      # Rutas protegidas
│   └── (public)/    # Rutas públicas
├── components/      # Componentes React
├── lib/            # Utilidades y servicios
├── supabase/       # Migraciones y scripts SQL
└── public/         # Archivos estáticos
```

## 🔐 Autenticación y Seguridad

- Sistema de autenticación con Supabase Auth
- Row Level Security (RLS) en todas las tablas
- Roles de usuario: Admin y Vendedor
- Políticas de acceso por tienda

## 📊 Base de Datos

### Tablas Principales

- `users` - Usuarios del sistema
- `stores` - Tiendas/ubicaciones
- `clients` - Clientes
- `suppliers` - Proveedores
- `brands` - Marcas
- `lines` - Líneas de productos
- `categories` - Categorías
- `sizes` - Tallas
- `products` - Productos
- `stock` - Inventario
- `sales` - Ventas
- `credit_plans` - Planes de crédito
- `installments` - Cuotas
- `payments` - Pagos
- `collection_actions` - Acciones de cobranza
- `cash_shifts` - Turnos de caja

## 🧪 Validación

El sistema ha sido validado exhaustivamente con Playwright. Ver reportes:
- `VALIDACION_CATALOGOS.md` - Análisis del código
- `PLAN_PRUEBAS_PLAYWRIGHT.md` - Plan de pruebas
- `REPORTE_VALIDACION_PLAYWRIGHT.md` - Resultados completos

## 📝 Documentación Adicional

- `ANALISIS_BASE_DATOS.md` - Análisis completo de la base de datos
- `AUDITORIA_SEGURIDAD_COMPLETA.md` - Auditoría de seguridad
- `COMO_EJECUTAR_SCRIPTS.md` - Guía para ejecutar scripts SQL

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conectar el repositorio a Vercel
2. Configurar variables de entorno
3. Desplegar

### Otras Plataformas

El proyecto es compatible con cualquier plataforma que soporte Next.js:
- Netlify
- Railway
- AWS Amplify
- etc.

## 🤝 Contribución

Este es un proyecto privado. Para contribuir, contactar al propietario del repositorio.

## 📄 Licencia

Todos los derechos reservados © 2026 Adiction Boutique

## 👥 Autor

- **Gilmore369** - [GitHub](https://github.com/Gilmore369)

## 🆘 Soporte

Para soporte o preguntas, abrir un issue en el repositorio.

---

**Última actualización**: Marzo 2026  
**Versión**: 1.0.0  
**Estado**: ✅ Producción
