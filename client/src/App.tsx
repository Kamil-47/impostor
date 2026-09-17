import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import CreateRoomPage from './pages/CreateRoomPage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SocketProvider>
          <BrowserRouter>
            <Header />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/create" element={<CreateRoomPage />} />
              <Route path="/join" element={<JoinRoomPage />} />
              <Route path="/join/:code" element={<JoinRoomPage />} />
              <Route path="/room/:code" element={<RoomPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
