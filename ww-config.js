export default {
  editor: {
    label: { en: 'Admin Dev Failures' },
    icon: 'alert-triangle',
    categories: ['data'],
    deprecated: false,
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    accessToken: {
      label: { en: 'Auth Token' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    userId: {
      label: { en: 'User ID' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    timeRange: {
      label: { en: 'Default Time Range' },
      type: 'TextSelect',
      options: {
        options: [
          { value: '1h',  label: { en: '1 Hour' } },
          { value: '6h',  label: { en: '6 Hours' } },
          { value: '24h', label: { en: '24 Hours' } },
          { value: '7d',  label: { en: '7 Days' } },
        ],
      },
      bindable: true,
      defaultValue: '24h',
    },
    refreshInterval: {
      label: { en: 'Auto-refresh Interval (s)' },
      type: 'Number',
      bindable: true,
      defaultValue: 30,
      options: { min: 10, max: 300 },
    },
    refreshTrigger: {
      label: { en: 'Refresh Trigger' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    portalTarget: {
      label: { en: 'Portal Target' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    userRole: {
      label: { en: 'User Role' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
  },
  triggerEvents: [
    {
      name: 'devfailures:acknowledged',
      label: { en: 'On Alert Acknowledged' },
      event: { alertId: '', datasetName: '' },
    },
    {
      name: 'devfailures:error',
      label: { en: 'On Error' },
      event: { message: '' },
    },
  ],
};
