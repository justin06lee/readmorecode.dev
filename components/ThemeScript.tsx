const THEME_KEY = "readmorecode-theme";

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  var key = ${JSON.stringify(THEME_KEY)};
  var stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  var theme = stored === 'light' ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
})();
`,
      }}
    />
  );
}
