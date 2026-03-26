// src/teacher/utils/authStorage.js

// Teacher Password Storage (using localStorage for simplicity)
export const teacherAuthStorage = {
  getPassword() {
    const stored = localStorage.getItem("teacherPassword");
    return stored || "admin"; // Default password
  },

  setPassword(newPassword) {
    localStorage.setItem("teacherPassword", newPassword);
  },

  validatePassword(password) {
    return password === this.getPassword();
  }
};

// Student Password Storage (using localStorage with key prefix)
export const studentAuthStorage = {
  getPassword(rollNo) {
    return localStorage.getItem(`student_${rollNo}`) || rollNo; // Default to roll number
  },

  setPassword(rollNo, password) {
    localStorage.setItem(`student_${rollNo}`, password);
  },

  validatePassword(rollNo, password) {
    const storedPassword = this.getPassword(rollNo);
    return password === storedPassword;
  },

  deletePassword(rollNo) {
    localStorage.removeItem(`student_${rollNo}`);
  }
};
