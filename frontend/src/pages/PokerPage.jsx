import React from 'react';
import PokerTable from '../components/PokerTable/PokerTable';
import Dashboard from '../components/Dashboard/Dashboard';
import { useGameStore } from '../store/gameStore';

const PokerPage = () => {
  const { gameState, playerId } = useGameStore();

  return (
    <div className="game-container">
      <PokerTable gameState={gameState} playerId={playerId} />
      <Dashboard gameState={gameState} />
    </div>
  );
};

export default PokerPage;
