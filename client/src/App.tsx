import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ListDetail from './pages/ListDetail';
import AlbumPage from './pages/AlbumPage';
import SharedList from './pages/SharedList';
import ChartBrowser from './pages/ChartBrowser';
import Search from './pages/Search';
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import PageLayout from './components/PageLayout';
import RequireAuth from './components/RequireAuth';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import ExtensionConnect from './pages/ExtensionConnect';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="shared/:slug" element={<SharedList />} />
        <Route element={<RequireAuth />}>
          <Route element={<PageLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="charts" element={<ChartBrowser />} />
            <Route path="settings" element={<Settings />} />
            <Route path="extension/connect" element={<ExtensionConnect />} />
            <Route path="lists/:listId/albums/:albumId" element={<AlbumPage />} />
            <Route path="lists/:id" element={<ListDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
