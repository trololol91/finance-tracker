import type {DashboardSummaryDto} from '../api/model/dashboardSummaryDto.js';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';
import type {ToolModule} from './types.js';

export const dashboardTools: ToolModule<DashboardSummaryDto>[] = [
    {
        name: 'get_dashboard_summary',
        description:
            'Get dashboard summary including net worth, income, expenses and savings rate.',
        inputSchema: {
            type: 'object',
            properties: {
                month: {
                    type: 'string',
                    description: 'Month in YYYY-MM format. Defaults to current month.'
                }
            }
        },
        handle: async (token, args): Promise<DashboardSummaryDto> => {
            const params: Record<string, string> = {};
            if (args.month && typeof args.month === 'string') {
                params.month = args.month;
            }
            return tokenStorage.run(token, () =>
                mcpFetcher<DashboardSummaryDto>({url: '/api/dashboard/summary', method: 'GET', params})
            );
        }
    }
];
