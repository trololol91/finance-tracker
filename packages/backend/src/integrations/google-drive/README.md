# Google Drive Directory Services

This directory contains services for managing Google Drive directories in the Finance Tracker application.

## Available Services

### 1. GoogleDriveService

Base service for Google Drive operations including creating, uploading, downloading, updating, and deleting files and folders.

### 2. GoogleDriveDirectoryService

Specialized service for directory management in Google Drive:

- Creating directories and nested directory structures
- Finding directories by name
- Listing subdirectories
- Moving directories
- Recursive deletion of directories
- Creating complex directory structures from templates

## Usage Examples

### Creating a Directory Structure

```typescript
// Inject the service in your constructor
constructor(
  private readonly directoryService: GoogleDriveDirectoryService
) {}

// Create a directory structure using a template
async createFinanceDirectories() {
  const template = {
    name: 'Finance',
    children: [
      {
        name: 'Income',
        children: [
          { name: 'Salary' },
          { name: 'Investments' }
        ]
      },
      {
        name: 'Expenses',
        children: [
          { name: 'Housing' },
          { name: 'Transportation' }
        ]
      }
    ]
  };
  
  const rootDir = await this.directoryService.createDirectoryStructure(template);
  console.log(`Created finance structure with ID: ${rootDir.id}`);
}
```

### Creating Directory Paths

```typescript
// Create a nested directory path
const path = ['Finance', '2025', 'June', '15'];
const dateDir = await this.directoryService.createDirectoryPath(path);
console.log(`Created directory path: ${dateDir.id}`);
```

## Authentication

The Google Drive services require proper authentication setup. Configure authentication in the `initializeDrive` method of the `GoogleDriveService` class using one of the following approaches:

1. **Service Account** (recommended for server applications)
2. **OAuth2** (for user-based authentication)
3. **API Key** (limited functionality)

Example configuration for a service account:

```typescript
private initializeDrive(): void {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, 
    });

    this.drive = google.drive({
      version: 'v3',
      auth,
    });
  } catch (error) {
    this.logger.error('Failed to initialize Google Drive service', error);
    throw error;
  }
}
```

## Required Environment Variables

Set the following environment variables for authentication:

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to the service account key file (JSON)

## Directory Structure Template Interface

The `DirectoryTemplate` interface can be used to define complex directory structures:

```typescript
interface DirectoryTemplate {
  name: string;
  children?: DirectoryTemplate[];
}

// Example usage
const template: DirectoryTemplate = {
  name: 'Projects',
  children: [
    {
      name: '2025',
      children: [
        { name: 'Q1' },
        { name: 'Q2' },
        { name: 'Q3' },
        { name: 'Q4' },
      ]
    }
  ]
};
```
