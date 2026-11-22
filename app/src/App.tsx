import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DataProvider, useData } from './lib/store'
import { Layout, homeOf } from './components/Layout'
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
import { AnalysisDetail, AnalysisList } from './pages/features/Analyses'
import { OrdersAdmin, StoreOrders } from './pages/features/Orders'
import { StoreVideoPage, StoreVideoProgress, VideoAdmin } from './pages/features/Videos'
import { DistributionAdmin, PartnerDashboard, PartnerDistribution } from './pages/features/Distribution'

function Home() {
  const { me, loaded } = useData()
  if (!loaded || !me) return <div className="p-8 text-slate-500">読み込み中…</div>
  return <Navigate to={homeOf(me)} replace />
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
            <Route path="/field/analyses" element={<AnalysisList />} />
            <Route path="/field/analyses/:id" element={<AnalysisDetail />} />
            <Route path="/field/videos" element={<StoreVideoPage />} />
            <Route path="/field/orders" element={<StoreOrders />} />
            <Route path="/fc/analyses" element={<AnalysisList />} />
            <Route path="/fc/analyses/:id" element={<AnalysisDetail />} />
            <Route path="/fc/orders" element={<StoreOrders />} />
            <Route path="/fc/videos" element={<StoreVideoProgress />} />
            <Route path="/hq/analyses" element={<AnalysisList />} />
            <Route path="/hq/analyses/:id" element={<AnalysisDetail />} />
            <Route path="/hq/orders" element={<OrdersAdmin />} />
            <Route path="/hq/videos" element={<VideoAdmin />} />
            <Route path="/hq/distribution" element={<DistributionAdmin />} />
            <Route path="/partner" element={<PartnerDashboard />} />
            <Route path="/partner/analyses" element={<AnalysisList />} />
            <Route path="/partner/analyses/:id" element={<AnalysisDetail />} />
            <Route path="/partner/orders" element={<OrdersAdmin />} />
            <Route path="/partner/videos" element={<VideoAdmin />} />
            <Route path="/partner/distribution" element={<PartnerDistribution />} />
            <Route path="/learn/:storeId" element={<StoreVideoPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  )
}
