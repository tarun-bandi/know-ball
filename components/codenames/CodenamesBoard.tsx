import { View } from 'react-native';
import CodenamesCard from './CodenamesCard';
import type { GameStateCards } from '@/lib/codenamesApi';

interface Props {
  cards: GameStateCards[];
  isSpymasterView: boolean;
  onCardPress: (index: number) => void;
  disabled: boolean;
}

export default function CodenamesBoard({ cards, isSpymasterView, onCardPress, disabled }: Props) {
  const rows = [0, 1, 2, 3, 4];

  return (
    <View className="items-center px-2">
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
            />
          ))}
        </View>
      ))}
    </View>
  );
}
