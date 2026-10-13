import { app } from './app.js'
import { env } from './shared/config/env.js'
import { cancelExpiredOrders } from './features/orders/orders.service.js'

app.listen(env.port, () => console.log(`API jalan di http://localhost:${env.port}`))

// Order PENDING yang lewat 24 jam dibatalkan + stoknya dikembalikan. Dicek saat start lalu tiap jam.
const runCancelJob = () => cancelExpiredOrders().catch((err) => console.error('Auto-cancel order gagal:', err))
runCancelJob()
setInterval(runCancelJob, 60 * 60 * 1000)
