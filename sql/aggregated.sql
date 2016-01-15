
-- Filter variables
DECLARE @Now DateTime = GETDATE()
DECLARE @StartOfToday DateTime = DATEADD(day, DATEDIFF(day, 0, @Now), 0)
DECLARE @StartOfWeek DateTime = DATEADD(ww, DATEDIFF(ww, 1, @Now), 0)

-- Variables to ultimately select
DECLARE @MaxWaitingTime Real
DECLARE @AverageWaitingTime Real
DECLARE @NumberOfCalls Real
DECLARE @AverageCallDurationSeconds Real
DECLARE @CallsLessThan60Seconds Real
DECLARE @NumberOfCallsThisWeek Real
DECLARE @AverageCallDurationSecondsThisWeek Real

SELECT @MaxWaitingTime =(MAX([tQueueWait]) / 1000)
      ,@AverageWaitingTime = (AVG([tQueueWait]) / 1000)
      ,@NumberOfCalls = COUNT(*)
      ,@AverageCallDurationSeconds = AVG([CallDurationSeconds])
FROM  [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
  AND [InitiatedDate] > @StartOfToday
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'

SELECT @CallsLessThan60Seconds = (CAST(COUNT(*) AS Real) / @NumberOfCalls) * 100
FROM  [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
  AND [InitiatedDate] > @StartOfToday
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
  AND ([tQueueWait] / 1000) < 60

SELECT @NumberOfCallsThisWeek = COUNT(*)
      ,@AverageCallDurationSecondsThisWeek = (AVG([tQueueWait]) / 1000)
FROM [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
  AND [InitiatedDate] > @StartOfWeek
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'

SELECT
     @MaxWaitingTime                        AS [Max waiting time in seconds]
    ,@AverageWaitingTime                    AS [Average waiting time in seconds]
    ,@NumberOfCalls                         AS [Number of calls]
    ,@AverageCallDurationSeconds            AS [Average call duration in seconds]
    ,@CallsLessThan60Seconds                AS [Percentage of calls shorter than a minute]
    ,@NumberOfCallsThisWeek                 AS [Number of calls this week]
    ,@AverageCallDurationSecondsThisWeek    AS [Average call duration in seconds this week]
