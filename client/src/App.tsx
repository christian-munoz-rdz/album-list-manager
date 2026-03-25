import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ListDetail from './pages/ListDetail';
import SharedList from './pages/SharedList';
import ChartBrowser from './pages/ChartBrowser';
import Navbar from './components/Navbar';
import PageLayout from './components/PageLayout';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<PageLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="charts" element={<ChartBrowser />} />
          <Route path="lists/:id" element={<ListDetail />} />
          <Route path="shared/:slug" element={<SharedList />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
