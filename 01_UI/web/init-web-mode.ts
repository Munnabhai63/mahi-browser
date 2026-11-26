try {
  localStorage.setItem('mahi_app_mode', 'web');
} catch {
  // Ignore storage restrictions in private browsing frames
}
