export interface TimezoneOption {
    value: string;
    label: string;
}

export const TIMEZONES: TimezoneOption[] = [
    {value: 'America/New_York', label: 'Eastern Time (ET)'},
    {value: 'America/Chicago', label: 'Central Time (CT)'},
    {value: 'America/Denver', label: 'Mountain Time (MT)'},
    {value: 'America/Los_Angeles', label: 'Pacific Time (PT)'},
    {value: 'America/Anchorage', label: 'Alaska Time (AKT)'},
    {value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)'},
    {value: 'America/Toronto', label: 'Toronto (ET)'},
    {value: 'America/Vancouver', label: 'Vancouver (PT)'},
    {value: 'America/Halifax', label: 'Halifax (AT)'},
    {value: 'America/Winnipeg', label: 'Winnipeg (CT)'},
    {value: 'America/Regina', label: 'Saskatchewan (CT)'},
    {value: 'America/Edmonton', label: 'Edmonton (MT)'},
    {value: 'America/St_Johns', label: "St. John's (NT)"},
    {value: 'Europe/London', label: 'London (GMT/BST)'},
    {value: 'Europe/Paris', label: 'Paris (CET/CEST)'},
    {value: 'Europe/Berlin', label: 'Berlin (CET/CEST)'},
    {value: 'Asia/Tokyo', label: 'Tokyo (JST)'},
    {value: 'Asia/Shanghai', label: 'Shanghai (CST)'},
    {value: 'Asia/Singapore', label: 'Singapore (SGT)'},
    {value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)'},
    {value: 'UTC', label: 'UTC'}
];

export const formatDate = (isoString: string): string =>
    new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
