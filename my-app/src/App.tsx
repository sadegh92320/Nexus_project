import { Routes, Route, Navigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import ResultPage from './pages/ResultPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />

      {/* Correct route: plural 'results' and param name 'paperId' */}
      <Route path="/results/:paperId" element={<ResultPage />} />

      {/* Optional: backward compatibility if you ever navigated to /result/:query */}
      <Route path="/result/:query" element={<Navigate to="/results/:query" replace />} />

      {/* Optional: catch-all to avoid white screens on typos */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

