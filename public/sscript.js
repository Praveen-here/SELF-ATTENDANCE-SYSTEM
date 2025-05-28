// Fetch and display student list
async function fetchStudents() {
    const tableBody = document.querySelector("#student-list");
    tableBody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

    try {
        // Dynamic API URL
        const API_BASE_URL = window.location.hostname.includes("localhost") 
            ? "http://localhost:9000" 
            : "https://attendance-co83.onrender.com"; 

        const res = await fetch(`${API_BASE_URL}/teacher/students`);

        if (!res.ok) {
            throw new Error(`Failed to fetch student data. Status: ${res.status}`);
        }

        const students = await res.json();
        tableBody.innerHTML = "";

        if (!Array.isArray(students) || students.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='4'>No students found</td></tr>";
            return;
        }

        // Generate device ID if not exists
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = self.crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
        }

        students.forEach(student => {
            if (!student.studentID || !student.name) return;
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="p-2 border">${student.studentID}</td>
                <td class="p-2 border">${student.name}</td>
                <td class="p-2 border text-center">
                    <input type="checkbox" class="student-checkbox" data-id="${student.studentID}">
                </td>
                <td class="p-2 border text-center">
                    <button class="reset-password-btn bg-blue-500 text-white px-2 py-1 rounded text-sm"
                            data-id="${student.studentID}">
                        Reset Password
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to reset password buttons
        document.querySelectorAll('.reset-password-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const studentID = e.target.dataset.id;
                resetPassword(studentID);
            });
        });

    } catch (error) {
        tableBody.innerHTML = "<tr><td colspan='4' style='color:red;'>Error loading students</td></tr>";
        console.error("Error fetching students:", error);
    }
}

// Password reset function
async function resetPassword(studentID) {
    if (!confirm(`Reset password for student ${studentID}? Default will be their student ID.`)) {
        return;
    }
    
    try {
        const API_BASE_URL = window.location.hostname.includes("localhost") 
            ? "http://localhost:9000" 
            : "https://attendance-co83.onrender.com";
        
        const res = await fetch(`${API_BASE_URL}/teacher/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentID })
        });
        
        if (res.ok) {
            alert('Password reset successfully!');
        } else {
            const error = await res.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Password reset error:', error);
        alert('Failed to reset password');
    }
}

// Add student function
async function addStudent() {
    const studentID = document.getElementById('new-student-id').value;
    const name = document.getElementById('new-student-name').value;
    const password = document.getElementById('new-student-password').value;
    
    if (!studentID || !name) {
        alert('Student ID and Name are required');
        return;
    }
    
    try {
        const API_BASE_URL = window.location.hostname.includes("localhost") 
            ? "http://localhost:9000" 
            : "https://attendance-co83.onrender.com";
        
        const res = await fetch(`${API_BASE_URL}/teacher/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentID, name, password })
        });
        
        if (res.ok) {
            alert('Student added successfully!');
            document.getElementById('new-student-id').value = '';
            document.getElementById('new-student-name').value = '';
            document.getElementById('new-student-password').value = '';
            fetchStudents(); // Refresh list
        } else {
            const error = await res.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student');
    }
}

// Load students when the page loads
document.addEventListener("DOMContentLoaded", fetchStudents);