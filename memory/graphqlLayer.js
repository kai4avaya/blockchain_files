import { buildSchema, graphql } from 'graphql';

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

const root = {
  getData: async ({ id }) => {
    return getData(id);
  },
  saveData: async ({ id, content }) => {
    const data = { id, content };
    await saveData(data);
    return data;
  }
};


export async function executeGraphQL(query, variables) {
    return graphql(schema, query, root, null, variables);
  }
  


// EXAMPLE
// Save data
// const saveMutation = `
//   mutation SaveData($id: ID!, $content: String!) {
//     saveData(id: $id, content: $content) {
//       id
//       content
//     }
//   }
// `;

// await executeGraphQL(saveMutation, { id: '1', content: 'Hello, World!' });

// // Get data
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
