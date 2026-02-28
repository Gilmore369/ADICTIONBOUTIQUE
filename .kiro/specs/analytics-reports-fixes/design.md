# Analytics Reports Bugfix Design

## Overview

El módulo de reportes analíticos presenta 13 defectos críticos que impiden su funcionamiento completo. El problema principal es la falta de 10 funciones RPC SQL que el frontend espera encontrar, junto con errores matemáticos en las funciones existentes que devuelven "N/A" en lugar de valores numéricos controlados.

La estrategia de corrección se divide en tres categorías:
1. **Crear funciones RPC faltantes** (10 funciones nuevas)
2. **Corregir cálculos matemáticos** en funciones existentes usando NULLIF() y COALE