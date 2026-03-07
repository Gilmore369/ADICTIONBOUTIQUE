import { getReturnsAction } from '@/actions/returns'
import { ReturnsManagementView } from '@/components/returns/returns-management-view'

export const metadata = {
  title: 'Devoluciones | ADICTION BOUTIQUE',
  description: 'Gestión de devoluciones y cambios'
}

export default async function ReturnsPage() {
  const { data: returns } = await getReturnsAction()

  return <ReturnsManagementView initialReturns={returns} />
}
