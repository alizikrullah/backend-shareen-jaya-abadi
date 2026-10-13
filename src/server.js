import { app } from './app.js'
import { env } from './shared/config/env.js'

app.listen(env.port, () => console.log(`API jalan di http://localhost:${env.port}`))
