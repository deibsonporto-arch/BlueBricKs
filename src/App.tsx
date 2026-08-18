import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ObrasListPage } from './pages/ObrasListPage';
import { ModelosPage } from './pages/ModelosPage';
import { MateriaisPage } from './pages/MateriaisPage';
import { HistoricoPrecosPage } from './pages/HistoricoPrecosPage';
import { FerramentasPage } from './pages/FerramentasPage';
import { LocalFerramentasPage } from './pages/LocalFerramentasPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { LoginPage } from './pages/LoginPage';
import { ObraDetailPage } from './pages/ObraDetailPage';
import { VisaoGeralTab } from './pages/obra-tabs/VisaoGeralTab';
import { OrcamentoTab } from './pages/obra-tabs/OrcamentoTab';
import { PmoMensalTab } from './pages/obra-tabs/PmoMensalTab';
import { DiarioDeObraTab } from './pages/obra-tabs/DiarioDeObraTab';
import { ProximaSemanaTab } from './pages/obra-tabs/ProximaSemanaTab';
import { RequisicoesTab } from './pages/obra-tabs/RequisicoesTab';
import { MapaDeCotacaoTab } from './pages/obra-tabs/MapaDeCotacaoTab';
import { FinanceiroTab } from './pages/obra-tabs/FinanceiroTab';
import { EmpreitaTab } from './pages/obra-tabs/EmpreitaTab';
import { LocacaoDeBensMoveisTab } from './pages/obra-tabs/LocacaoDeBensMoveisTab';
import { FerramentasTab } from './pages/obra-tabs/FerramentasTab';
import { AlmoxarifadoTab } from './pages/obra-tabs/AlmoxarifadoTab';
import { useAuth } from './hooks/useAuth';

function App() {
  const { usuarioAtual, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Carregando...
      </div>
    );
  }

  if (!usuarioAtual) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/obras" replace />} />
        <Route path="/obras" element={<ObrasListPage />} />
        <Route path="/modelos" element={<ModelosPage />} />
        <Route path="/materiais" element={<MateriaisPage />} />
        <Route path="/historico-precos" element={<HistoricoPrecosPage />} />
        <Route path="/ferramentas" element={<FerramentasPage />} />
        <Route path="/ferramentas/locais/:localId" element={<LocalFerramentasPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/obras/:id" element={<ObraDetailPage />}>
          <Route index element={<Navigate to="visao-geral" replace />} />
          <Route path="visao-geral" element={<VisaoGeralTab />} />
          <Route path="orcamento" element={<OrcamentoTab />} />
          <Route path="pmo-mensal" element={<PmoMensalTab />} />
          <Route path="diario-de-obra" element={<DiarioDeObraTab />} />
          <Route path="proxima-semana" element={<ProximaSemanaTab />} />
          <Route path="requisicoes" element={<RequisicoesTab />} />
          <Route path="mapa-cotacao" element={<MapaDeCotacaoTab />} />
          <Route path="financeiro" element={<FinanceiroTab />} />
          <Route path="empreita" element={<EmpreitaTab />} />
          <Route path="locacao-de-bens-moveis" element={<LocacaoDeBensMoveisTab />} />
          {/* rota mantida (sem aba visível na nav) pra não quebrar o link que a página global de
              Ferramentas faz pra cada obra como "localização" */}
          <Route path="ferramentas" element={<FerramentasTab />} />
          <Route path="almoxarifado" element={<AlmoxarifadoTab />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
