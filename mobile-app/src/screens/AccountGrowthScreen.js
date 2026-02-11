import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAccount } from '../context/AccountContext';
import { journalAPI } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

const TIME_FILTERS = [
    { key: 'WEEK', label: '1W' },
    { key: 'MONTH', label: '1M' },
    { key: 'YEAR', label: '1Y' },
    { key: 'ALL', label: 'All' },
];

const getFilterStartDate = (filterKey) => {
    const now = new Date();
    switch (filterKey) {
        case 'WEEK':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        case 'MONTH':
            return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case 'YEAR':
            return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case 'ALL':
        default:
            return null;
    }
};

const AccountGrowthScreen = ({ navigation }) => {
    const { currentAccount } = useAccount();
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [allEntries, setAllEntries] = useState([]);
    const [stats, setStats] = useState({
        startBalance: 0,
        currentBalance: 0,
        netProfit: 0,
        growthPercentage: 0,
        totalTrades: 0,
        winRate: 0,
        wins: 0,
        losses: 0,
    });

    const startingBalance = parseFloat(currentAccount?.starting_balance) || 0;

    const fetchAllEntries = async () => {
        if (!currentAccount) return;
        try {
            const data = await journalAPI.getEntries(1, 500, '', currentAccount.id);
            const entries = (data.entries || [])
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            setAllEntries(entries);
        } catch (error) {
            console.error('Error fetching growth data:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        computeStats();
    }, [allEntries, timeFilter, startingBalance]);

    const computeStats = () => {
        if (!allEntries.length) {
            setChartData(null);
            setStats({
                startBalance: startingBalance,
                currentBalance: startingBalance,
                netProfit: 0,
                growthPercentage: 0,
                totalTrades: 0,
                winRate: 0,
                wins: 0,
                losses: 0,
            });
            return;
        }

        // Only closed trades (have pnl), sorted by EXIT time (updated_at)
        // This is critical: balance/pnl are recorded at exit, so updated_at
        // is the correct chronological ordering, not created_at (open time).
        const allClosed = allEntries
            .filter(e => e.pnl !== null && e.pnl !== undefined)
            .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

        if (allClosed.length === 0) {
            setChartData(null);
            setStats({
                startBalance: startingBalance,
                currentBalance: startingBalance,
                netProfit: 0,
                growthPercentage: 0,
                totalTrades: 0,
                winRate: 0,
                wins: 0,
                losses: 0,
            });
            return;
        }

        // Time filter: use updated_at (exit time) since that's when PnL is realized
        const filterStart = getFilterStartDate(timeFilter);
        let preFilterTrades = [];
        let filteredTrades = allClosed;

        if (filterStart) {
            preFilterTrades = allClosed.filter(e => new Date(e.updated_at) < filterStart);
            filteredTrades = allClosed.filter(e => new Date(e.updated_at) >= filterStart);
        }

        // Overall stats (always from all closed trades, not filter-dependent)
        const totalPnL = allClosed.reduce((sum, e) => sum + (parseFloat(e.pnl) || 0), 0);
        const overallBalance = startingBalance + totalPnL;
        const netProfit = totalPnL;
        const growthPct = startingBalance > 0 ? (netProfit / startingBalance) * 100 : 0;

        // Build equity curve using cumulative PnL (not raw balance values).
        // Raw balance can be misleading if entries came from different MT5 accounts
        // or if trades overlapped. Cumulative PnL from starting_balance gives
        // a true performance curve.
        const preFilterPnL = preFilterTrades.reduce((sum, e) => sum + (parseFloat(e.pnl) || 0), 0);
        const periodStartBal = startingBalance + preFilterPnL;

        const chartPoints = [periodStartBal];
        const chartLabels = ['Start'];
        let runningBalance = periodStartBal;

        filteredTrades.forEach(item => {
            runningBalance += parseFloat(item.pnl) || 0;
            const date = new Date(item.updated_at);
            chartLabels.push(`${date.getDate()}/${date.getMonth() + 1}`);
            chartPoints.push(runningBalance);
        });

        if (chartPoints.length >= 2) {
            const maxLabels = 8;
            let displayLabels = chartLabels;
            if (chartPoints.length > maxLabels) {
                const step = Math.ceil(chartPoints.length / maxLabels);
                displayLabels = chartLabels.map((label, i) =>
                    (i === 0 || i === chartLabels.length - 1 || i % step === 0) ? label : ''
                );
            }
            setChartData({
                labels: displayLabels,
                datasets: [{ data: chartPoints }],
            });
        } else {
            setChartData(null);
        }

        // Win/Loss from filtered period only
        const wins = filteredTrades.filter(e => parseFloat(e.pnl) > 0).length;
        const losses = filteredTrades.filter(e => parseFloat(e.pnl) < 0).length;
        const totalClosed = filteredTrades.length;
        const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

        setStats({
            startBalance: startingBalance,
            currentBalance: overallBalance,
            netProfit,
            growthPercentage: growthPct,
            totalTrades: totalClosed,
            winRate,
            wins,
            losses,
        });
    };

    useFocusEffect(
        useCallback(() => {
            setIsLoading(true);
            fetchAllEntries();
        }, [currentAccount])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAllEntries();
    }, [currentAccount]);

    const renderChart = () => {
        if (!chartData || chartData.datasets[0].data.length < 2) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="bar-chart-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>Not enough data to graph.</Text>
                    <Text style={styles.emptySubText}>Record at least 2 trades with automated exits.</Text>
                </View>
            );
        }

        return (
            <View style={styles.chartContainer}>
                <LineChart
                    data={chartData}
                    width={screenWidth - 40}
                    height={220}
                    yAxisLabel="$"
                    chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => stats.netProfit >= 0
                            ? `rgba(80, 200, 120, ${opacity})`
                            : `rgba(255, 107, 107, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                            r: "3",
                            strokeWidth: "1.5",
                            stroke: stats.netProfit >= 0 ? "#50C878" : "#FF6B6B"
                        },
                        propsForBackgroundLines: {
                            strokeDasharray: '',
                            stroke: '#f0f0f0',
                        },
                    }}
                    bezier
                    style={{ marginVertical: 8, borderRadius: 16 }}
                />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Growth</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
            >
                {/* Main Balance Card */}
                <LinearGradient
                    colors={stats.netProfit >= 0 ? ['#4A90E2', '#50C878'] : ['#e74c3c', '#c0392b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.balanceCard}
                >
                    <Text style={styles.balanceLabel}>Current Balance</Text>
                    <Text style={styles.balanceValue}>${(Number(stats.currentBalance) || 0).toFixed(2)}</Text>
                    <View style={styles.growthBadge}>
                        <Ionicons name={stats.growthPercentage >= 0 ? "trending-up" : "trending-down"} size={16} color="#fff" />
                        <Text style={styles.growthText}>
                            {stats.growthPercentage >= 0 ? '+' : ''}{(Number(stats.growthPercentage) || 0).toFixed(2)}%
                        </Text>
                    </View>
                </LinearGradient>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Start Balance</Text>
                        <Text style={styles.statValue}>${(Number(stats.startBalance) || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Net Profit</Text>
                        <Text style={[styles.statValue, { color: stats.netProfit >= 0 ? '#50C878' : '#FF6B6B' }]}>
                            {stats.netProfit >= 0 ? '+' : ''}${(Number(stats.netProfit) || 0).toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* Trade Statistics Card */}
                <View style={styles.winRateCard}>
                    <Text style={styles.sectionTitleNoMargin}>Trade Statistics</Text>
                    <View style={styles.winRateRow}>
                        <View style={styles.winRateStat}>
                            <Text style={styles.winRateValue}>{stats.winRate.toFixed(1)}%</Text>
                            <Text style={styles.winRateLabel}>Win Rate</Text>
                        </View>
                        <View style={styles.winRateDivider} />
                        <View style={styles.winRateStat}>
                            <Text style={[styles.winRateValue, { color: '#50C878' }]}>{stats.wins}</Text>
                            <Text style={styles.winRateLabel}>Wins</Text>
                        </View>
                        <View style={styles.winRateDivider} />
                        <View style={styles.winRateStat}>
                            <Text style={[styles.winRateValue, { color: '#FF6B6B' }]}>{stats.losses}</Text>
                            <Text style={styles.winRateLabel}>Losses</Text>
                        </View>
                        <View style={styles.winRateDivider} />
                        <View style={styles.winRateStat}>
                            <Text style={styles.winRateValue}>{stats.totalTrades}</Text>
                            <Text style={styles.winRateLabel}>Total</Text>
                        </View>
                    </View>
                </View>

                {/* Time Filter + Chart */}
                <View style={styles.filterRow}>
                    <Text style={styles.sectionTitle}>Performance Curve</Text>
                    <View style={styles.filterContainer}>
                        {TIME_FILTERS.map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[styles.filterBtn, timeFilter === f.key && styles.filterBtnActive]}
                                onPress={() => setTimeFilter(f.key)}
                            >
                                <Text style={[styles.filterText, timeFilter === f.key && styles.filterTextActive]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#4A90E2" style={{ marginTop: 40 }} />
                ) : (
                    renderChart()
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    scrollContent: {
        padding: 20,
    },
    balanceCard: {
        padding: 25,
        borderRadius: 20,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
    },
    balanceValue: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    growthText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 16,
        marginHorizontal: 5,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statLabel: {
        color: '#666',
        fontSize: 12,
        marginBottom: 5,
    },
    statValue: {
        color: '#333',
        fontSize: 18,
        fontWeight: 'bold',
    },
    winRateCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitleNoMargin: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    winRateRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    winRateStat: {
        alignItems: 'center',
        flex: 1,
    },
    winRateValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    winRateLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
        fontWeight: '500',
    },
    winRateDivider: {
        width: 1,
        height: 35,
        backgroundColor: '#f1f5f9',
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    filterBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    filterBtnActive: {
        backgroundColor: '#667eea',
    },
    filterText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    filterTextActive: {
        color: '#fff',
    },
    chartContainer: {
        backgroundColor: 'transparent',
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        height: 220,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    emptySubText: {
        marginTop: 5,
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
    },
});

export default AccountGrowthScreen;
