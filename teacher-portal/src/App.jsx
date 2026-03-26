import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MembersProvider } from "./teacher/context/MembersContext";
import LoginSwitcher from "./pages/auth/LoginSwitcher";
import TeacherDashboard from "./teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";

function App() {
  return (
    <MembersProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginSwitcher />} />
          <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
        </Routes>
      </Router>
    </MembersProvider>
  );
}

export default App;
