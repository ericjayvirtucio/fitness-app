import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { createNutritionLoggingUseCases } from '../../../composition/nutrition-logging';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  LoadingIndicator,
  Screen,
  SectionHeader,
  TextField,
  spacing,
} from '../../../design-system';
import type { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import { formatNutritionEnergy } from './nutrition-formatting';

type UseCases = Awaited<ReturnType<typeof createNutritionLoggingUseCases>>;
type Result = Readonly<{
  favorites: readonly NutritionCatalogItem[];
  recent: readonly NutritionCatalogItem[];
  search: readonly NutritionCatalogItem[];
}>;
type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ result: Result; status: 'ready'; useCases: UseCases }>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onLog: (id: string) => void;
  onManual: () => void;
}>;

export function NutritionCatalogBrowserScreen({
  loadUseCases = createNutritionLoggingUseCases,
  onCreate,
  onEdit,
  onLog,
  onManual,
}: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (useCases) => {
        const [favorites, recent] = await Promise.all([
          useCases.browseCatalog.listFavorites(),
          useCases.browseCatalog.listRecent(),
        ]);
        setState({
          result: { favorites, recent, search: [] },
          status: 'ready',
          useCases,
        });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases]);

  useFocusEffect(load);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const timeout = setTimeout(() => {
      void state.useCases.browseCatalog
        .search(query)
        .then((search) =>
          setState((current) =>
            current.status === 'ready'
              ? { ...current, result: { ...current.result, search } }
              : current,
          ),
        )
        .catch(() => setState({ status: 'error' }));
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, state.status === 'ready' ? state.useCases : undefined]);

  if (state.status === 'loading') {
    return (
      <Screen accessibilityLabel="Loading saved nutrition items" isCentered>
        <LoadingIndicator label="Loading saved nutrition items" />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen accessibilityLabel="Saved nutrition items error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Saved items unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your saved items could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );
  }

  const hasItems =
    state.result.favorites.length > 0 || state.result.recent.length > 0;
  const toggleFavorite = async (item: NutritionCatalogItem) => {
    try {
      await state.useCases.setCatalogFavorite.execute(
        item.id.value,
        !item.isFavorite,
      );
      load();
    } catch {
      setState({ status: 'error' });
    }
  };

  return (
    <Screen
      accessibilityLabel="Add nutrition from saved items"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Add nutrition
        </AppText>
        <AppText color="secondary">
          Reuse a saved profile or enter a one-time item. Everything works
          offline.
        </AppText>
      </View>
      <TextField
        label="Search saved foods and beverages"
        onChangeText={setQuery}
        value={query}
      />
      {query.trim() !== '' ? (
        <CatalogSection
          items={state.result.search}
          onEdit={onEdit}
          onFavorite={(item) => void toggleFavorite(item)}
          onLog={onLog}
          title="Search results"
        />
      ) : hasItems ? (
        <>
          <CatalogSection
            items={state.result.favorites}
            onEdit={onEdit}
            onFavorite={(item) => void toggleFavorite(item)}
            onLog={onLog}
            title="Favorites"
          />
          <CatalogSection
            items={state.result.recent}
            onEdit={onEdit}
            onFavorite={(item) => void toggleFavorite(item)}
            onLog={onLog}
            title="Recently used"
          />
        </>
      ) : (
        <EmptyState
          actionLabel="Create first saved item"
          description="Save nutrition facts once for faster food and beverage logging."
          icon="nutrition-outline"
          onAction={onCreate}
          title="No saved items yet"
        />
      )}
      <SectionHeader title="Other ways to add" />
      <AppButton label="Create reusable item" onPress={onCreate} />
      <AppButton
        label="Enter one-time item"
        onPress={onManual}
        variant="outline"
      />
    </Screen>
  );
}

function CatalogSection({
  items,
  onEdit,
  onFavorite,
  onLog,
  title,
}: Readonly<{
  items: readonly NutritionCatalogItem[];
  onEdit: (id: string) => void;
  onFavorite: (item: NutritionCatalogItem) => void;
  onLog: (id: string) => void;
  title: string;
}>) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <AppText color="secondary">No {title.toLowerCase()}.</AppText>
      ) : (
        items.map((item) => (
          <Card key={item.id.value} variant="outlined">
            <AppText variant="heading">{item.facts.description}</AppText>
            <AppText color="secondary">{catalogSummary(item)}</AppText>
            <View style={{ gap: spacing.sm }}>
              <AppButton
                accessibilityLabel={`Log ${item.facts.description}`}
                label="Log amount"
                onPress={() => onLog(item.id.value)}
              />
              <AppButton
                accessibilityLabel={`${item.isFavorite ? 'Remove' : 'Add'} ${item.facts.description} ${item.isFavorite ? 'from' : 'to'} favorites`}
                label={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                onPress={() => onFavorite(item)}
                variant="outline"
              />
              <AppButton
                accessibilityLabel={`Edit ${item.facts.description}`}
                label="Edit saved item"
                onPress={() => onEdit(item.id.value)}
                variant="ghost"
              />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

function catalogSummary(item: NutritionCatalogItem): string {
  const amount =
    item.facts.reference.kind === 'mass'
      ? `${item.facts.reference.amount.grams} g`
      : `${item.facts.reference.amount.milliliters} mL`;
  return `${item.kind === 'food' ? 'Food' : 'Beverage'} · per ${amount} · ${formatNutritionEnergy(item.facts.energy)}`;
}
