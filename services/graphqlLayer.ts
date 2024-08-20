import { buildSchema, GraphQLArgs, graphql } from 'graphql';
import { getData as fetchFromDB, saveData as saveToDB } from '../local/db'; // Assuming these are the actual data interaction functions



// Define GraphQL schema
const schema = buildSchema(`
  type Query {
    getData(id: ID!): Data
  }

  type Mutation {
    saveData(id: ID!, content: String!): Data
  }

  type Data {
    id: ID!
    content: String!
  }
`);

// Define resolvers
const root = {
  getData: async ({ id }: { id: string }) => {
    return fetchFromDB('graph', id);
  },
  saveData: async ({ id, content }: { id: string; content: string }) => {
    const data = { id, content };
    await saveToDB('graph', data);
    return data;
  }
};

// Function to execute GraphQL queries/mutations
export async function executeGraphQL(query: string, variables: Record<string, any>) {
  const args: GraphQLArgs = { schema, rootValue: root, contextValue: null, variableValues: variables, operationName :query };
  return graphql(args);
}

// Placeholder function for now to initiate fetch and then timeout
export async function fetchGraphDataFromServer() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

interface Source {
  query: string;
  variables: Record<string, any>;
} 


const query = `
  query GetData($id: ID!) {
    getData(id: $id) {
      id
      content
    }
  }
`;
const variables: Record<string, any> = {}; // Define variables with a type

const args: GraphQLArgs = {
  schema,
  rootValue: root,
  contextValue: null,
  variableValues: variables,
  operationName: query,
  source: { query, variables } as Source as string | Source
};

// Example usage of GraphQL execution (currently commented out)
// const saveMutation = `
//   mutation SaveData($id: ID!, $content: String!) {
//     saveData(id: $id, content: $content) {
//       id
//       content
//     }
//   }
// `;

// await executeGraphQL(saveMutation, { id: '1', content: 'Hello, World!' });

// const getQuery = `
//   query GetData($id: ID!) {
//     getData(id: $id) {
//       id
//       content
//     }
//   }
// `;

// const result = await executeGraphQL(getQuery, { id: '1' });
// console.log(result.data.getData);
