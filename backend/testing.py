from jira import JIRA


jira = JIRA(server='', basic_auth=("", None))

print(jira.projects())