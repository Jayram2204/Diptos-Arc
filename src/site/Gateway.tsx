import { WalletProvider } from '@/app/wallet'
import { KineticFlywheel } from '@/components/KineticFlywheel'
import { Architecture } from './Architecture'
import { EscrowsGrid } from './EscrowsGrid'
import { Faucet } from './Faucet'
import { Footer } from './Footer'
import { Header } from './Header'
import { Hero } from './Hero'
import { ProcessBar } from './ProcessBar'
import { Registry } from './Registry'
import { Telemetry } from './Telemetry'
import { Waterfall } from './Waterfall'

export function Gateway() {
  return (
    <WalletProvider>
      <div className="min-h-screen">
        <KineticFlywheel />
        <Header />
        <main>
          <Hero />
          <ProcessBar />
          <EscrowsGrid />
          <Architecture />
          <Telemetry />
          <Waterfall />
          <Registry />
          <Faucet />
        </main>
        <Footer />
      </div>
    </WalletProvider>
  )
}
