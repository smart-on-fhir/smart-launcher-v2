import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Cluster,
  Compatibility,
  ContainerImage,
  FargateService,
  TaskDefinition,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";

export class DeploymentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Create a new VPC and cluster that will be used to run the service.
    const vpc = new Vpc(this, "CsiroSmartProxyVpc", { maxAzs: 2 });
    const cluster = new Cluster(this, "CsiroSmartProxyCluster", { vpc: vpc });

    const lb = new ApplicationLoadBalancer(this, "CsiroSmartProxyLoadBalancer", {
      vpc,
      internetFacing: true,
    });

    const hostedZone = HostedZone.fromHostedZoneAttributes(
        this,
        "CsiroSmartFormsHostedZone",
        {
          hostedZoneId: "Z0507963281Q0BWHKV1OD",
          zoneName: "smartforms.io",
        }
    );

    const certificate = new Certificate(this, "CsiroSmartFormsCertificate", {
      domainName: "proxy.smartforms.io",
      validation: CertificateValidation.fromDns(hostedZone),
    });

    new ARecord(this, "CsiroSmartFormsSmartProxyAliasRecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(lb)),
      recordName: "proxy.smartforms.io",
    });


    const listener = lb.addListener("CsiroSmartProxyListener", {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [certificate],
    });

    const containerName = "CsiroSmartProxy";
    const containerPort = 80;
    const taskDefinition = new TaskDefinition(this, "CsiroSmartProxyTaskDefinition", {
      compatibility: Compatibility.FARGATE,
      cpu: "256",
      memoryMiB: "512",
    });

    // Create the cache container.
    taskDefinition.addContainer("CsiroSmartProxyContainer", {
      containerName: containerName,
      image: ContainerImage.fromRegistry("aehrc/smart-launcher-v2:latest"),
      portMappings: [{ containerPort: containerPort }],
    });
    const smartProxyService = new FargateService(this, "CsiroSmartProxyService", {
      cluster,
      taskDefinition,
    });

    // Create a target for the assemble service, routed from the "/fhir/$assemble" path.
    const smartProxyTarget = smartProxyService.loadBalancerTarget({
      containerName: containerName,
      containerPort: containerPort,
    });

    const smartProxyTargetGroup = new ApplicationTargetGroup(
        this,
        "CsiroSmartProxyTargetGroup",
        {
          vpc,
          port: containerPort,
          protocol: ApplicationProtocol.HTTP,
          targets: [smartProxyTarget],
          healthCheck: { path: "/v/r4/fhir/metadata" },
        }
    );
    listener.addAction("CsiroSmartProxyDefaultAction", {
      action: ListenerAction.forward([smartProxyTargetGroup]),
    });
  }
}
