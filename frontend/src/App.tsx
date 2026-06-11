import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import Dashboard from './pages/Dashboard/Dashboard';
import MeetingRoom from './pages/MeetingRoom/MeetingRoom';
import LeftMeeting from './pages/LeftMeeting/LeftMeeting';
import './App.css';

// Guard for protected pages (Dashboard)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#0460ff',
      dark: '#0d4dbd',
      contrastText: '#ffffff',
    },
    success: {
      main: '#04ae75',
      dark: '#038c5e',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ff3535',
      dark: '#dd2a2a',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#171731',
      secondary: '#1f3456',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      'Google Sans Flex',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '2rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Dashboard Route */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Public Join Meeting Route (Auth checked internally for Role definition) */}
          <Route path="/room/:roomId" element={<MeetingRoom />} />

          {/* Left Meeting Page */}
          <Route path="/left-meeting/:roomId" element={<LeftMeeting />} />

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
