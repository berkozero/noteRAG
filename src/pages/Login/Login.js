import { Auth } from '../../services/auth/auth.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        console.log('Login button found');
        loginButton.addEventListener('click', async () => {
            console.log('Login button clicked');
            const auth = new Auth();
            await auth.login();
        });
    } else {
        console.error('Login button not found');
    }
}); 