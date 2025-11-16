/**
 * Parse query parameters into filter options
 * Supports:
 * - Simple equality: ?field=value
 * - Operators: ?field__gt=10, ?field__lt=20, ?field__gte=5, ?field__lte=15, ?field__ne=value
 * - Array contains: ?field__in=value1,value2,value3
 * - Text search: ?search=text (searches across string fields)
 * - Status filter: ?status=published
 */
function parseQuery(query) {
  const filters = {};
  const options = {
    filters: {},
    search: null,
    sort: null,
    limit: null,
    offset: 0
  };

  for (const [key, value] of Object.entries(query)) {
    // Handle pagination
    if (key === 'limit') {
      options.limit = parseInt(value, 10);
      if (isNaN(options.limit) || options.limit < 1) {
        options.limit = null;
      }
      continue;
    }

    if (key === 'offset') {
      options.offset = parseInt(value, 10);
      if (isNaN(options.offset) || options.offset < 0) {
        options.offset = 0;
      }
      continue;
    }

    // Handle sorting
    if (key === 'sort') {
      // Format: sort=field or sort=-field (descending)
      const sortField = value.startsWith('-') ? value.substring(1) : value;
      const direction = value.startsWith('-') ? 'desc' : 'asc';
      options.sort = { field: sortField, direction };
      continue;
    }

    // Handle search (full-text search across string fields)
    if (key === 'search') {
      options.search = value;
      continue;
    }

    // Handle field filters with operators
    const operatorMatch = key.match(/^(.+)__(gt|lt|gte|lte|ne|in|contains)$/);
    if (operatorMatch) {
      const [, field, operator] = operatorMatch;
      if (!filters[field]) {
        filters[field] = {};
      }
      
      if (operator === 'in') {
        // Parse comma-separated values
        filters[field][operator] = value.split(',').map(v => v.trim());
      } else {
        filters[field][operator] = value;
      }
      continue;
    }

    // Simple equality filter
    filters[key] = { eq: value };
  }

  options.filters = filters;
  return options;
}

/**
 * Apply filters to a content item
 */
function matchesFilters(item, filters) {
  for (const [field, conditions] of Object.entries(filters)) {
    const value = getNestedValue(item, field);
    
    for (const [operator, filterValue] of Object.entries(conditions)) {
      if (!matchesCondition(value, operator, filterValue)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if a value matches a condition
 */
function matchesCondition(value, operator, filterValue) {
  switch (operator) {
    case 'eq':
      return value == filterValue; // Use == for type coercion (string "true" == boolean true)
    
    case 'ne':
      return value != filterValue;
    
    case 'gt':
      return Number(value) > Number(filterValue);
    
    case 'gte':
      return Number(value) >= Number(filterValue);
    
    case 'lt':
      return Number(value) < Number(filterValue);
    
    case 'lte':
      return Number(value) <= Number(filterValue);
    
    case 'in':
      if (Array.isArray(value)) {
        // If value is an array, check if any element is in filterValue
        return value.some(v => filterValue.includes(String(v)));
      }
      return filterValue.includes(String(value));
    
    case 'contains':
      if (Array.isArray(value)) {
        return value.some(v => String(v).toLowerCase().includes(String(filterValue).toLowerCase()));
      }
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    
    default:
      return true;
  }
}

/**
 * Get nested value from object using dot notation (e.g., "author.name")
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Apply search across string fields
 */
function matchesSearch(item, searchTerm) {
  if (!searchTerm) return true;
  
  const searchLower = searchTerm.toLowerCase();
  
  // Search in all string fields recursively
  function searchInObject(obj) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (searchInObject(value)) return true;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  return searchInObject(item);
}

/**
 * Sort items by field
 */
function sortItems(items, sortConfig) {
  if (!sortConfig || !sortConfig.field) {
    return items;
  }
  
  const { field, direction } = sortConfig;
  const isDesc = direction === 'desc';
  
  return items.sort((a, b) => {
    const aValue = getNestedValue(a, field);
    const bValue = getNestedValue(b, field);
    
    // Handle undefined/null values
    if (aValue === undefined || aValue === null) return isDesc ? -1 : 1;
    if (bValue === undefined || bValue === null) return isDesc ? 1 : -1;
    
    // Compare values
    if (aValue < bValue) return isDesc ? 1 : -1;
    if (aValue > bValue) return isDesc ? -1 : 1;
    return 0;
  });
}

/**
 * Apply pagination
 */
function paginateItems(items, limit, offset) {
  if (limit === null) {
    return items.slice(offset);
  }
  return items.slice(offset, offset + limit);
}

module.exports = {
  parseQuery,
  matchesFilters,
  matchesSearch,
  sortItems,
  paginateItems
};

