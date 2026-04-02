// Enhanced UI Components for HRMS
// Modern, accessible components with consistent design system

// Core Components
export { ErrorBoundary, PageErrorBoundary } from './ErrorBoundary';
export { 
  EmptyState, 
  NoEmployees, 
  NoDepartments, 
  NoTeams, 
  NoAttendance, 
  NoSearchResults, 
  NoData, 
  NoFiles 
} from './EmptyState';
export { 
  ConfirmDialog, 
  DeleteConfirmDialog, 
  BulkDeleteConfirmDialog, 
  StatusChangeConfirmDialog,
  useConfirmDialog 
} from './ConfirmDialog';
export { DataTable, createColumn } from './DataTable';
export { Breadcrumb, PageHeader, useBreadcrumb } from './Breadcrumb';

// Form Components
export {
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Alert,
  ValidationSummary,
  FormLoading
} from './Form';

// Loading Components
export {
  Skeleton,
  CardSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  StatsCardsSkeleton,
  PageSkeleton
} from './Skeleton';
