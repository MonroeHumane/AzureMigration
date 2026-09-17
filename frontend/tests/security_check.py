from playwright.sync_api import sync_playwright

def test_security():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        page.goto('http://127.0.0.1:8399/internal/')
        
        # Test 1: Fake email + random 6-character password should FAIL
        page.fill('#unified-email', 'attacker@monroe-humane.org')
        page.fill('#unified-password', '123456')
        page.click('#unified-submit-btn')
        page.wait_for_timeout(4500)
        
        is_auth = page.evaluate("() => document.documentElement.classList.contains('staff-authenticated')")
        err_text = page.locator('#login-error-text').text_content() or ''
        print('Backdoor rejected:', not is_auth, '| Error message:', err_text.strip())
        assert not is_auth, 'Security Failure: Backdoor still works!'
        
        # Test 2: Rate limiting lockout after 5 attempts
        for i in range(4):
            page.fill('#unified-password', f'wrongpass{i}')
            page.click('#unified-submit-btn')
            page.wait_for_timeout(4500)
            
        lockout_err = page.locator('#login-error-text').text_content() or ''
        print('Lockout triggered:', 'Too many' in lockout_err, '| Message:', lockout_err.strip())
        assert 'Too many' in lockout_err, 'Rate limit failure!'
        
        browser.close()
        print('ALL NEGATIVE SECURITY TESTS PASSED!')

if __name__ == '__main__':
    test_security()
