import { supabase } from './supabase.js';

const loginForm = document.getElementById('adminLoginForm');
const msg = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const btn = document.getElementById('btnLogin');

        btn.innerText = "VERIFYING...";
        btn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                msg.className = "text-danger";
                msg.innerText = "Access Denied: " + error.message;
                btn.innerText = "Unlock Citadel";
                btn.disabled = false;
            } else {
                // Check role in profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (profile && profile.role === 'admin') {
                    msg.className = "text-success";
                    msg.innerText = "Credentials Verified. Opening Citadel...";
                    // Set a flag to signal this is a direct portal login
                    sessionStorage.setItem('admin_portal_session', 'true');
                    setTimeout(() => { window.location.href = '/grandmaster-admin.html'; }, 1000);
                } else {
                    await supabase.auth.signOut();
                    msg.className = "text-danger";
                    msg.innerText = "Intruder Alert: You are not a Grandmaster!";
                    btn.innerText = "Unlock Citadel";
                    btn.disabled = false;
                }
            }
        } catch (err) {
            console.error("Login Error:", err);
            msg.innerText = "Unexpected error occurred.";
            btn.disabled = false;
        }
    });
}