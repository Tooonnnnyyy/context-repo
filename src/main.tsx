import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/dm-mono/400.css'
import './styles.css'
import './reference-system.css'

createRoot(document.getElementById('root')!).render(<App />)
