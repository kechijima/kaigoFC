import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DataProvider, useData } from './lib/store'
import { Layout } from './components/Layout'
import Dashboard from './pages/hq/Dashboard'
import Deals from './pages/hq/Deals'
import DealDetail from './pages/hq/DealDetail'
import MyTasks from './pages/hq/MyTasks'
import Invoices from './pages/hq/Invoices'
import Stores from './pages/hq/Stores'
import Settings from './pages/hq/Settings'
import { ContractList, ContractPage, NoticeList } from './pages/shared'
import { FcHome, FcInvoices, FcReport, FcWorkflow } from './pages/fc/FcPages'
import { FieldClients, FieldSchedule, FieldSummary, FieldToday, FieldVisit } from './pages/field/FieldPages'

function Home() {
  const { me, loaded } = useData()
  if (!loaded || !me) return <div className="p-8 text-slate-500">読み込み中…</div>
  return <Navigate to={me.kind === 'hq' ? '/hq' : me.kind === 'fc' ? '/fc' : '/field'} replace />
}

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<Layout />}>
            <Route path="/hq" element={<Dashboard />} />
            <Route path="/hq/tasks" element={<MyTasks />} />
            <Route path="/hq/deals" element={<Deals />} />
            <Route path="/hq/deals/:id" element={<DealDetail />} />
            <Route path="/hq/contracts" element={<ContractList />} />
            <Route path="/hq/contracts/:id" element={<ContractPage />} />
            <Route path="/hq/invoices" element={<Invoices />} />
            <Route path="/hq/stores" element={<Stores />} />
            <Route path="/hq/notices" element={<NoticeList />} />
            <Route path="/hq/settings" element={<Settings />} />
            <Route path="/fc" element={<FcHome />} />
            <Route path="/fc/workflow" element={<FcWorkflow />} />
            <Route path="/fc/contracts" element={<ContractList />} />
            <Route path="/fc/contracts/:id" element={<ContractPage />} />
            <Route path="/fc/invoices" element={<FcInvoices />} />
            <Route path="/fc/report" element={<FcReport />} />
            <Route path="/fc/notices" element={<NoticeList />} />
            <Route path="/field" element={<FieldToday />} />
            <Route path="/field/visits/:id" element={<FieldVisit />} />
            <Route path="/field/schedule" element={<FieldSchedule />} />
            <Route path="/field/clients" element={<FieldClients />} />
            <Route path="/field/summary" element={<FieldSummary />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  )
}
