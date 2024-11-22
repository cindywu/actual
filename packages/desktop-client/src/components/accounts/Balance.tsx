import React, { useRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useHover } from 'usehooks-ts';

import { isPreviewId } from 'loot-core/shared/transactions';
import { useCachedSchedules } from 'loot-core/src/client/data-hooks/schedules';
import { q } from 'loot-core/src/shared/query';
import { getScheduledAmount } from 'loot-core/src/shared/schedules';
import { type AccountEntity } from 'loot-core/types/models';

import { useSelectedItems } from '../../hooks/useSelected';
import { SvgArrowButtonRight1 } from '../../icons/v2';
import { theme } from '../../style';
import { Button } from '../common/Button2';
import { Text } from '../common/Text';
import { View } from '../common/View';
import { PrivacyFilter } from '../PrivacyFilter';
import { CellValue, CellValueText } from '../spreadsheet/CellValue';
import { type SheetFields, type SheetNames } from '../spreadsheet/index';
import { useFormat } from '../spreadsheet/useFormat';
import { useSheetValue } from '../spreadsheet/useSheetValue';

import { type ReconcilingMessage } from './Reconcile';

type DetailedBalanceProps = {
  name: string;
  balance: number | null;
  isExactBalance: boolean;
};

function DetailedBalance({
  name,
  balance,
  isExactBalance = true,
}: DetailedBalanceProps) {
  const format = useFormat();
  return (
    <Text
      style={{
        marginLeft: 15,
        borderRadius: 4,
        padding: '4px 6px',
        color: theme.pillText,
        backgroundColor: theme.pillBackground,
      }}
    >
      {name}{' '}
      <PrivacyFilter>
        <Text style={{ fontWeight: 600 }}>
          {!isExactBalance && '~ '}
          {format(balance, 'financial')}
        </Text>
      </PrivacyFilter>
    </Text>
  );
}

function SelectedBalance({
  selectedItems,
  account,
}: {
  selectedItems: Set<string>;
  account: AccountEntity;
}) {
  const { t } = useTranslation();

  type SelectedBalanceName = `selected-balance-${string}`;
  const name = `selected-balance-${[...selectedItems].join('-')}`;

  const rows = useSheetValue<'balance', SelectedBalanceName>({
    name: name as SelectedBalanceName,
    query: q('transactions')
      .filter({
        id: { $oneof: [...selectedItems] },
        parent_id: { $oneof: [...selectedItems] },
      })
      .select('id'),
  });
  const ids = new Set(Array.isArray(rows) ? rows.map(r => r.id) : []);

  const finalIds = [...selectedItems].filter(id => !ids.has(id));
  type SelectedBalanceSumName = `selected-balance-${string}-sum`;
  let balance = useSheetValue<'balance', SelectedBalanceName>({
    name: (name + '-sum') as SelectedBalanceSumName,
    query: q('transactions')
      .filter({ id: { $oneof: finalIds } })
      .options({ splits: 'all' })
      .calculate({ $sum: '$amount' }),
  });

  let scheduleBalance = 0;

  const { isLoading, schedules = [] } = useCachedSchedules();

  if (isLoading) {
    return null;
  }

  const previewIds = [...selectedItems]
    .filter(id => isPreviewId(id))
    .map(id => id.slice(8));
  let isExactBalance = true;

  for (const s of schedules) {
    if (previewIds.includes(s.id)) {
      // If a schedule is `between X and Y` then we calculate the average
      if (s._amountOp === 'isbetween') {
        isExactBalance = false;
      }

      if (!account || account.id === s._account) {
        scheduleBalance += getScheduledAmount(s._amount);
      } else {
        scheduleBalance -= getScheduledAmount(s._amount);
      }
    }
  }

  if (balance == null) {
    if (scheduleBalance == null) {
      return null;
    } else {
      balance = scheduleBalance;
    }
  } else if (scheduleBalance != null) {
    balance += scheduleBalance;
  }

  return (
    <DetailedBalance
      name={t('Selected balance:')}
      balance={balance}
      isExactBalance={isExactBalance}
    />
  );
}

function FilteredBalance({ filteredAmount }: { filteredAmount: number }) {
  const { t } = useTranslation();

  return (
    <DetailedBalance
      name={t('Filtered balance:')}
      balance={filteredAmount || 0}
      isExactBalance={true}
    />
  );
}

function MoreBalances({
  balanceQuery,
}: {
  balanceQuery: ComponentProps<typeof ReconcilingMessage>['balanceQuery'];
}) {
  const { t } = useTranslation();

  type SelectedBalanceClearedName = `balance-query-${string}-cleared`;
  const cleared = useSheetValue<'balance', SelectedBalanceClearedName>({
    name: (balanceQuery.name + '-cleared') as SelectedBalanceClearedName,
    query: balanceQuery.query.filter({ cleared: true }),
  });

  type SelectedBalanceUnclearedName = `balance-query-${string}-uncleared`;
  const uncleared = useSheetValue<'balance', SelectedBalanceUnclearedName>({
    name: (balanceQuery.name + '-uncleared') as SelectedBalanceUnclearedName,
    query: balanceQuery.query.filter({ cleared: false }),
  });

  return (
    <View style={{ flexDirection: 'row' }}>
      <DetailedBalance
        name={t('Cleared total:')}
        balance={cleared}
        isExactBalance
      />
      <DetailedBalance
        name={t('Uncleared total:')}
        balance={uncleared}
        isExactBalance
      />
    </View>
  );
}

type BalancesProps = {
  balanceQuery: ComponentProps<typeof ReconcilingMessage>['balanceQuery'];
  showExtraBalances: boolean;
  onToggleExtraBalances: () => void;
  account: AccountEntity;
  isFiltered: boolean;
  filteredAmount: number;
};

export function Balances({
  balanceQuery,
  showExtraBalances,
  onToggleExtraBalances,
  account,
  isFiltered,
  filteredAmount,
}: BalancesProps) {
  const selectedItems = useSelectedItems();
  const buttonRef = useRef(null);
  const isButtonHovered = useHover(buttonRef);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -5,
        marginLeft: -5,
      }}
    >
      <Button
        ref={buttonRef}
        data-testid="account-balance"
        variant="bare"
        onPress={onToggleExtraBalances}
        style={{
          paddingTop: 1,
          paddingBottom: 1,
        }}
      >
        <CellValue
          binding={{
            name: balanceQuery.name as SheetFields<SheetNames>,
            query: balanceQuery.query,
            value: 0,
          }}
          type="financial"
        >
          {props => (
            <CellValueText
              {...props}
              style={{
                fontSize: 22,
                fontWeight: 400,
                color:
                  props.value < 0
                    ? theme.errorText
                    : props.value > 0
                      ? theme.noticeTextLight
                      : theme.pageTextSubdued,
              }}
            />
          )}
        </CellValue>

        <SvgArrowButtonRight1
          style={{
            width: 10,
            height: 10,
            marginLeft: 10,
            color: theme.pillText,
            transform: showExtraBalances ? 'rotateZ(180deg)' : 'rotateZ(0)',
            opacity:
              isButtonHovered || selectedItems.size > 0 || showExtraBalances
                ? 1
                : 0,
          }}
        />
      </Button>
      {showExtraBalances && <MoreBalances balanceQuery={balanceQuery} />}

      {selectedItems.size > 0 && (
        <SelectedBalance selectedItems={selectedItems} account={account} />
      )}
      {isFiltered && <FilteredBalance filteredAmount={filteredAmount} />}
    </View>
  );
}