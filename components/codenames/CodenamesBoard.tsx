import { View, useWindowDimensions } from 'react-native';
import CodenamesCard from './CodenamesCard';
import type { GameStateCards } from '@/lib/codenamesApi';
import type { Sport } from '@/types/database';

interface Props {
  cards: GameStateCards[];
  isSpymasterView: boolean;
  onCardPress: (index: number) => void;
  disabled: boolean;
  maxWidth?: number;
  sport?: Sport;
}

export default function CodenamesBoard({ cards, isSpymasterView, onCardPress, disabled, maxWidth, sport }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const boardWidth = maxWidth ? Math.min(screenWidth, maxWidth) : screenWidth;
  const cardSize = (boardWidth - 16) / 5;
  const rows = [0, 1, 2, 3, 4];

  return (
    <View className="items-center px-1">
      {rows.map((row) => (
        <View key={row} className="flex-row">
          {cards.slice(row * 5, row * 5 + 5).map((card, col) => (
            <CodenamesCard
              key={row * 5 + col}
              card={card}
              index={row * 5 + col}
              isSpymasterView={isSpymasterView}
              onPress={onCardPress}
              disabled={disabled}
              cardSize={cardSize}
              sport={sport}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
